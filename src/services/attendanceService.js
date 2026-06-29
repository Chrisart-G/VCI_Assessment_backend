// backend/src/services/attendanceService.js
import { db } from '../config/firebase.js'
import { 
  calculateRegularHours,
  calculateOvertime,
  calculateNightDiff,
  calculateLate,
  getTodayDate,
  timeToMinutes
} from '../utils/timeHelpers.js'

/**
 * Helper to get date string from timestamp (handles all formats)
 */
function getDateFromTimestamp(timestamp) {
  if (!timestamp) return null
  
  try {
    let date = null
    
    if (typeof timestamp.toDate === 'function') {
      date = timestamp.toDate()
    }
    else if (timestamp._seconds !== undefined) {
      date = new Date(timestamp._seconds * 1000)
    }
    else if (typeof timestamp === 'string') {
      date = new Date(timestamp)
    }
    else if (timestamp instanceof Date) {
      date = timestamp
    }
    else {
      date = new Date(timestamp)
    }
    
    if (!date || isNaN(date.getTime())) return null
    return date.toISOString().split('T')[0]
  } catch (error) {
    console.error('Error parsing timestamp:', error)
    return null
  }
}

/**
 * Helper to convert any timestamp to Date
 */
function toDate(timestamp) {
  if (!timestamp) return null
  
  try {
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate()
    }
    if (timestamp._seconds !== undefined) {
      return new Date(timestamp._seconds * 1000)
    }
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp)
      return isNaN(date.getTime()) ? null : date
    }
    if (timestamp instanceof Date) {
      return timestamp
    }
    const date = new Date(timestamp)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

/**
 * Get or create user profile
 */
export async function getOrCreateUserProfile(userId) {
  console.log('🔍 Getting/Creating profile for user:', userId)
  
  try {
    const userDoc = await db.collection('users').doc(userId).get()
    
    if (userDoc.exists) {
      const data = userDoc.data()
      console.log('✅ User profile found:', { 
        name: data.name, 
        role: data.role,
        schedule: data.schedule 
      })
      return data
    }
    
    console.log('📝 Creating new profile for user:', userId)
    
    const defaultProfile = {
      name: 'Employee',
      email: '',
      role: 'employee',
      timezone: 'Asia/Manila',
      schedule: { 
        start: '09:00', 
        end: '18:00' 
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    await db.collection('users').doc(userId).set(defaultProfile)
    console.log('✅ Default profile created for:', userId)
    
    return defaultProfile
  } catch (error) {
    console.error('❌ Error in getOrCreateUserProfile:', error)
    return {
      name: 'Employee',
      email: '',
      role: 'employee',
      timezone: 'Asia/Manila',
      schedule: { start: '09:00', end: '18:00' }
    }
  }
}

/**
 * Get all punches for a user on a specific date
 */
export async function getUserPunchesByDate(userId, date) {
  console.log('🔍 Getting punches for userId:', userId, 'date:', date)
  
  try {
    const snapshot = await db.collection('attendance')
      .where('userId', '==', userId)
      .get()
    
    const allPunches = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }))
    
    console.log(`📊 Found ${allPunches.length} total punches for user`)
    
    const filtered = allPunches.filter(p => {
      const punchDate = getDateFromTimestamp(p.timestamp)
      const match = punchDate === date
      if (match) {
        console.log(`✅ Found punch on ${date}: id=${p.id}, type=${p.type}`)
      }
      return match
    })
    
    filtered.sort((a, b) => {
      const aDate = toDate(a.timestamp)
      const bDate = toDate(b.timestamp)
      return aDate - bDate
    })
    
    console.log(`📊 Returning ${filtered.length} punches for date ${date}`)
    return filtered
  } catch (error) {
    console.error('❌ Error getting punches:', error)
    return []
  }
}

/**
 * Check if user already punched in today
 */
export async function getTodayPunch(userId) {
  const today = getTodayDate()
  console.log('🔍 Checking today\'s punch for userId:', userId)
  
  try {
    const punches = await getUserPunchesByDate(userId, today)
    
    if (punches.length === 0) {
      console.log('No punches today')
      return null
    }
    
    punches.sort((a, b) => {
      const aDate = toDate(a.timestamp)
      const bDate = toDate(b.timestamp)
      return bDate - aDate
    })
    
    console.log(`Latest punch today: type=${punches[0].type}`)
    return punches[0]
  } catch (error) {
    console.error('❌ Error getting today punch:', error)
    return null
  }
}

/**
 * Get the most recent punch
 */
export async function getLastPunch(userId) {
  console.log('🔍 Getting last punch for userId:', userId)
  
  try {
    const snapshot = await db.collection('attendance')
      .where('userId', '==', userId)
      .get()
    
    const punches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    
    if (punches.length === 0) {
      console.log('No punches found for user')
      return null
    }
    
    punches.sort((a, b) => {
      const aDate = toDate(a.timestamp)
      const bDate = toDate(b.timestamp)
      return bDate - aDate
    })
    
    console.log(`Last punch: id=${punches[0].id}, type=${punches[0].type}`)
    return punches[0]
  } catch (error) {
    console.error('❌ Error getting last punch:', error)
    return null
  }
}

/**
 * Calculate daily summary from punch records
 */
export async function calculateDailySummaryFromPunches(userId, date) {
  console.log('📊 Calculating daily summary from punches for:', userId, 'date:', date)
  
  const userProfile = await getOrCreateUserProfile(userId)
  const punches = await getUserPunchesByDate(userId, date)
  
  console.log(`📊 Found ${punches.length} punches`)
  
  if (punches.length === 0) {
    return null
  }
  
  const scheduleStart = userProfile.schedule?.start || '09:00'
  const scheduleEnd = userProfile.schedule?.end || '18:00'
  const timezone = userProfile.timezone || 'Asia/Manila'
  
  let firstPunchIn = null
  let lastPunchOut = null
  let totalWorkMinutes = 0
  let totalRegularHours = 0
  let totalOvertimeHours = 0
  let totalNightDiffHours = 0
  let totalLateMinutes = 0
  
  const punchIns = punches.filter(p => p.type === 'in' || p.type === 'punchIn')
  const punchOuts = punches.filter(p => p.type === 'out' || p.type === 'punchOut')
  
  if (punchIns.length > 0) {
    const sortedIns = [...punchIns].sort((a, b) => {
      const aDate = toDate(a.timestamp)
      const bDate = toDate(b.timestamp)
      return aDate - bDate
    })
    firstPunchIn = sortedIns[0]
  }
  
  if (punchOuts.length > 0) {
    const sortedOuts = [...punchOuts].sort((a, b) => {
      const aDate = toDate(a.timestamp)
      const bDate = toDate(b.timestamp)
      return bDate - aDate
    })
    lastPunchOut = sortedOuts[0]
  }
  
  if (firstPunchIn && lastPunchOut) {
    const inTime = toDate(firstPunchIn.timestamp)
    const outTime = toDate(lastPunchOut.timestamp)
    
    if (inTime && outTime && outTime > inTime) {
      const diffMs = outTime - inTime
      const diffHours = diffMs / (1000 * 60 * 60)
      totalWorkMinutes = Math.round(diffMs / 60000)
      
      if (diffHours <= 8) {
        totalRegularHours = diffHours
      } else {
        totalRegularHours = 8
        totalOvertimeHours = diffHours - 8
      }
      
      const options = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }
      const inTimeStr = inTime.toLocaleTimeString('en-US', options)
      const outTimeStr = outTime.toLocaleTimeString('en-US', options)
      
      totalLateMinutes = calculateLate(inTimeStr, scheduleStart)
      totalNightDiffHours = calculateNightDiff(inTimeStr, outTimeStr)
    }
  }
  
  const sortedAll = [...punches].sort((a, b) => {
    const aDate = toDate(a.timestamp)
    const bDate = toDate(b.timestamp)
    return bDate - aDate
  })
  const lastPunch = sortedAll.length > 0 ? sortedAll[0] : null
  const isActive = lastPunch && (lastPunch.type === 'in' || lastPunch.type === 'punchIn')
  
  const startMinutes = timeToMinutes(scheduleStart)
  const endMinutes = timeToMinutes(scheduleEnd)
  let shiftDuration = endMinutes - startMinutes
  if (shiftDuration < 0) {
    shiftDuration += 1440
  }
  const totalUndertimeMinutes = Math.max(0, shiftDuration - totalWorkMinutes)
  
  const summary = {
    userId,
    date,
    punchIn: firstPunchIn?.timestamp || null,
    punchOut: lastPunchOut?.timestamp || null,
    regularHours: Number(totalRegularHours.toFixed(4)),
    overtimeHours: Number(totalOvertimeHours.toFixed(4)),
    nightDiffHours: Number(totalNightDiffHours.toFixed(4)),
    lateMinutes: Math.round(totalLateMinutes),
    undertimeMinutes: Math.round(totalUndertimeMinutes),
    totalMinutes: totalWorkMinutes,
    totalHours: Number((totalWorkMinutes / 60).toFixed(4)),
    timezone: timezone,
    schedule: { start: scheduleStart, end: scheduleEnd },
    sessions: punches.length,
    isActive: isActive
  }
  
  return summary
}

/**
 * Get daily summary
 */
export async function getDailySummary(userId, date) {
  try {
    const snapshot = await db.collection('dailySummary')
      .where('userId', '==', userId)
      .where('date', '==', date)
      .limit(1)
      .get()
    
    if (snapshot.empty) return null
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
  } catch (error) {
    console.error('Error getting daily summary:', error)
    return null
  }
}

/**
 * Get weekly summary for a user
 */
export async function getWeeklySummary(userId, startDate, endDate) {
  console.log('🔍 Getting weekly summary for:', userId, 'from:', startDate, 'to:', endDate)
  
  try {
    const snapshot = await db.collection('dailySummary')
      .where('userId', '==', userId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
      .get()
    
    const summaries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    
    const totals = summaries.reduce((acc, curr) => {
      acc.totalRegularHours += curr.regularHours || 0
      acc.totalOvertimeHours += curr.overtimeHours || 0
      acc.totalNightDiffHours += curr.nightDiffHours || 0
      acc.totalLateMinutes += curr.lateMinutes || 0
      acc.totalUndertimeMinutes += curr.undertimeMinutes || 0
      acc.daysWorked++
      return acc
    }, {
      totalRegularHours: 0,
      totalOvertimeHours: 0,
      totalNightDiffHours: 0,
      totalLateMinutes: 0,
      totalUndertimeMinutes: 0,
      daysWorked: 0
    })
    
    return {
      summaries,
      totals,
      averageRegularHours: totals.daysWorked > 0 ? Number((totals.totalRegularHours / totals.daysWorked).toFixed(2)) : 0,
      averageOvertimeHours: totals.daysWorked > 0 ? Number((totals.totalOvertimeHours / totals.daysWorked).toFixed(2)) : 0
    }
  } catch (error) {
    console.error('❌ Error getting weekly summary:', error)
    return null
  }
}

/**
 * Process attendance - saves punch records and accumulates summary
 */
export async function processAttendance(userId, punchInDoc, punchOutDoc) {
  console.log('🔄 Processing attendance for userId:', userId)
  
  const userProfile = await getOrCreateUserProfile(userId)
  const today = getTodayDate()
  
  const summary = await calculateDailySummaryFromPunches(userId, today)
  
  if (summary) {
    const existingSummary = await getDailySummary(userId, today)
    
    if (existingSummary) {
      await db.collection('dailySummary').doc(existingSummary.id).update({
        regularHours: summary.regularHours,
        overtimeHours: summary.overtimeHours,
        nightDiffHours: summary.nightDiffHours,
        lateMinutes: summary.lateMinutes,
        undertimeMinutes: summary.undertimeMinutes,
        totalMinutes: summary.totalMinutes,
        totalHours: summary.totalHours,
        punchOut: summary.punchOut || new Date(),
        updatedAt: new Date()
      })
      console.log('✅ Updated daily summary')
    } else {
      await db.collection('dailySummary').add({
        userId,
        date: today,
        punchIn: summary.punchIn || new Date(),
        punchOut: summary.punchOut || new Date(),
        regularHours: summary.regularHours,
        overtimeHours: summary.overtimeHours,
        nightDiffHours: summary.nightDiffHours,
        lateMinutes: summary.lateMinutes,
        undertimeMinutes: summary.undertimeMinutes,
        totalMinutes: summary.totalMinutes,
        totalHours: summary.totalHours,
        schedule: userProfile.schedule || { start: '09:00', end: '18:00' },
        timezone: userProfile.timezone || 'Asia/Manila',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      console.log('✅ Created new daily summary')
    }
  }
  
  return summary
}

/**
 * Get active punch statistics
 */
export async function getActivePunchStats(userId, punchInDoc) {
  console.log('🔄 Getting active punch stats for:', userId)
  
  const userProfile = await getOrCreateUserProfile(userId)
  const today = getTodayDate()
  const summary = await calculateDailySummaryFromPunches(userId, today)
  
  if (!summary) {
    return {
      regularHours: 0,
      overtimeHours: 0,
      nightDiffHours: 0,
      lateMinutes: 0,
      undertimeMinutes: 0,
      totalMinutes: 0,
      totalHours: 0
    }
  }
  
  // Check if currently punched in
  const punches = await getUserPunchesByDate(userId, today)
  const sorted = punches.sort((a, b) => {
    const aDate = toDate(a.timestamp)
    const bDate = toDate(b.timestamp)
    return bDate - aDate
  })
  const lastPunch = sorted.length > 0 ? sorted[0] : null
  const isActive = lastPunch && (lastPunch.type === 'in' || lastPunch.type === 'punchIn')
  
  if (!isActive) {
    return null
  }
  
  return {
    regularHours: summary.regularHours || 0,
    overtimeHours: summary.overtimeHours || 0,
    nightDiffHours: summary.nightDiffHours || 0,
    lateMinutes: summary.lateMinutes || 0,
    undertimeMinutes: summary.undertimeMinutes || 0,
    totalMinutes: summary.totalMinutes || 0,
    totalHours: summary.totalHours || 0,
    isActive: true
  }
}

/**
 * Get attendance for admin view (with user info)
 */
export async function getAttendanceWithUserInfo(date) {
  console.log('🔍 Getting attendance with user info for:', date)
  
  try {
    const snapshot = await db.collection('dailySummary')
      .where('date', '==', date)
      .get()
    
    const summaries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    
    const userIds = [...new Set(summaries.map(s => s.userId))]
    const userPromises = userIds.map(id => db.collection('users').doc(id).get())
    const userDocs = await Promise.all(userPromises)
    
    const userMap = {}
    userDocs.forEach(doc => {
      if (doc.exists) {
        userMap[doc.id] = doc.data()
      }
    })
    
    return summaries.map(summary => ({
      ...summary,
      user: userMap[summary.userId] || null
    }))
  } catch (error) {
    console.error('❌ Error getting attendance with user info:', error)
    throw error
  }
}