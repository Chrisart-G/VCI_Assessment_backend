// backend/src/controllers/attendanceController.js
import { db } from '../config/firebase.js'
import { 
  getTodayPunch, 
  getLastPunch, 
  processAttendance,
  getUserPunchesByDate,
  calculateDailySummaryFromPunches
} from '../services/attendanceService.js'
import { getTodayDate } from '../utils/timeHelpers.js'

const serializeTimestamp = (value) => {
  if (!value) return null
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value)
    return isNaN(date.getTime()) ? null : date.toISOString()
  }
  if (value._seconds !== undefined && value._nanoseconds !== undefined) {
    return new Date(value._seconds * 1000 + Math.round(value._nanoseconds / 1e6)).toISOString()
  }
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date.toISOString()
}

const serializePunch = (punch) => ({
  ...punch,
  timestamp: serializeTimestamp(punch.timestamp)
})

const serializeSummary = (summary) => {
  if (!summary) return null
  return {
    ...summary,
    punchIn: serializeTimestamp(summary.punchIn),
    punchOut: serializeTimestamp(summary.punchOut),
    createdAt: serializeTimestamp(summary.createdAt),
    updatedAt: serializeTimestamp(summary.updatedAt)
  }
}

// Punch In
export const punchIn = async (req, res) => {
  try {
    const userId = req.user.uid
    
    console.log('📌 Punch In requested for user:', userId)
    
    const { getOrCreateUserProfile } = await import('../services/attendanceService.js')
    await getOrCreateUserProfile(userId)
    
    const existingPunch = await getTodayPunch(userId)
    if (existingPunch && existingPunch.type === 'in') {
      return res.status(400).json({
        success: false,
        message: 'You are already punched in today'
      })
    }
    
    const punchData = {
      userId,
      type: 'in',
      timestamp: new Date(),
      createdAt: new Date()
    }
    
    const docRef = await db.collection('attendance').add(punchData)
    
    console.log('✅ Punch In successful:', docRef.id)
    
    res.status(201).json({
      success: true,
      message: 'Punched in successfully',
      data: {
        id: docRef.id,
        ...punchData
      }
    })
  } catch (error) {
    console.error('❌ Punch In error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

// Punch Out
export const punchOut = async (req, res) => {
  try {
    const userId = req.user.uid
    
    console.log('📌 Punch Out requested for user:', userId)
    
    const { getOrCreateUserProfile } = await import('../services/attendanceService.js')
    await getOrCreateUserProfile(userId)
    
    const lastPunch = await getLastPunch(userId)
    console.log('Last punch:', lastPunch)
    
    if (!lastPunch || lastPunch.type !== 'in') {
      return res.status(400).json({
        success: false,
        message: 'No active punch in found'
      })
    }
    
    const punchOutData = {
      userId,
      type: 'out',
      timestamp: new Date(),
      createdAt: new Date()
    }
    
    const docRef = await db.collection('attendance').add(punchOutData)
    
    console.log('✅ Punch Out record created:', docRef.id)
    
    const punchInDoc = {
      ...lastPunch,
      timestamp: lastPunch.timestamp
    }
    
    const punchOutDoc = {
      ...punchOutData,
      timestamp: punchOutData.timestamp
    }
    
    await processAttendance(userId, punchInDoc, punchOutDoc)
    
    res.status(201).json({
      success: true,
      message: 'Punched out successfully',
      data: {
        id: docRef.id,
        ...punchOutData
      }
    })
  } catch (error) {
    console.error('❌ Punch Out error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

// Get today's attendance with summary
export const getTodayAttendance = async (req, res) => {
  try {
    const userId = req.user.uid
    const today = getTodayDate()
    
    console.log('📊 Getting today attendance for user:', userId, 'date:', today)
    
    // Get all punches for today using the fixed function
    const punches = await getUserPunchesByDate(userId, today)
    console.log('📊 Found punches:', punches.length)
    
    // Log each punch for debugging
    punches.forEach((p, i) => {
      let timestamp = p.timestamp
      if (timestamp?.toDate) {
        timestamp = timestamp.toDate()
      } else if (typeof timestamp === 'string') {
        timestamp = new Date(timestamp)
      } else if (timestamp?._seconds !== undefined) {
        timestamp = new Date(timestamp._seconds * 1000)
      }
      console.log(`  Punch ${i + 1}: id=${p.id}, type=${p.type}, time=${timestamp?.toISOString()}`)
    })
    
    // Serialize the response - handle Firestore timestamps
    const serializedPunches = punches.map(p => {
      let timestamp = p.timestamp
      if (timestamp?.toDate) {
        timestamp = timestamp.toDate().toISOString()
      } else if (typeof timestamp === 'string') {
        timestamp = new Date(timestamp).toISOString()
      } else if (timestamp?._seconds !== undefined) {
        timestamp = new Date(timestamp._seconds * 1000).toISOString()
      } else if (timestamp instanceof Date) {
        timestamp = timestamp.toISOString()
      } else {
        timestamp = new Date(timestamp).toISOString()
      }
      
      return {
        id: p.id,
        userId: p.userId,
        type: p.type,
        timestamp: timestamp,
        createdAt: p.createdAt?.toDate?.()?.toISOString() || new Date(p.createdAt).toISOString()
      }
    })
    
    console.log('📊 Serialized punches:', serializedPunches)
    
    // Get the summary
    const summary = await calculateDailySummaryFromPunches(userId, today)
    
    res.json({
      success: true,
      data: serializedPunches,
      summary: summary ? {
        ...summary,
        punchIn: summary.punchIn?.toISOString?.() || summary.punchIn,
        punchOut: summary.punchOut?.toISOString?.() || summary.punchOut
      } : null
    })
  } catch (error) {
    console.error('❌ Get today attendance error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

// Get attendance history (calculated from punches)
export const getHistory = async (req, res) => {
  try {
    const userId = req.user.uid
    const { startDate, endDate, limit = 30 } = req.query
    
    const end = endDate || getTodayDate()
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    // Get all dates in range
    const dates = []
    let currentDate = new Date(start)
    const endDateObj = new Date(end)
    
    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0]
      dates.push(dateStr)
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    // Calculate summary for each date dynamically
    const history = []
    for (const date of dates) {
      const summary = await calculateDailySummaryFromPunches(userId, date)
      if (summary && summary.totalMinutes > 0) {
        history.push(serializeSummary(summary))
      }
    }
    
    // Sort by date descending and limit
    history.sort((a, b) => b.date.localeCompare(a.date))
    const limitedHistory = history.slice(0, parseInt(limit))
    
    res.json({
      success: true,
      data: limitedHistory
    })
  } catch (error) {
    console.error('❌ Get history error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

// Get current punch status
export const getPunchStatus = async (req, res) => {
  try {
    const userId = req.user.uid
    const today = getTodayDate()
    
    const punches = await getUserPunchesByDate(userId, today)
    
    let isPunchedIn = false
    let lastPunch = null
    
    if (punches.length > 0) {
      lastPunch = punches[punches.length - 1]
      isPunchedIn = lastPunch.type === 'in'
    }
    
    res.json({
      success: true,
      data: {
        isPunchedIn,
        lastPunch: lastPunch ? serializePunch(lastPunch) : null,
        todayPunches: punches.map(serializePunch)
      }
    })
  } catch (error) {
    console.error('❌ Get punch status error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

// Get active punch stats
export const getActiveStats = async (req, res) => {
  try {
    const userId = req.user.uid
    const today = getTodayDate()
    
    const summary = await calculateDailySummaryFromPunches(userId, today)
    
    if (!summary) {
      return res.status(400).json({
        success: false,
        message: 'No punches found for today'
      })
    }
    
    // Check if currently punched in
    const punches = await getUserPunchesByDate(userId, today)
    const lastPunch = punches.length > 0 ? punches[punches.length - 1] : null
    const isActive = lastPunch && lastPunch.type === 'in'
    
    if (!isActive) {
      return res.status(400).json({
        success: false,
        message: 'User is not currently punched in'
      })
    }
    
    res.json({
      success: true,
      data: {
        regularHours: summary.regularHours || 0,
        overtimeHours: summary.overtimeHours || 0,
        nightDiffHours: summary.nightDiffHours || 0,
        lateMinutes: summary.lateMinutes || 0,
        undertimeMinutes: summary.undertimeMinutes || 0,
        totalMinutes: summary.totalMinutes || 0,
        totalHours: summary.totalHours || 0,
        punchInTime: lastPunch.timestamp,
        isActive: true
      }
    })
  } catch (error) {
    console.error('❌ Get active stats error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}