// backend/src/services/adminService.js
import { db } from '../config/firebase.js'
import { getTodayDate } from '../utils/timeHelpers.js'

/**
 * Get all users (employees)
 */
export async function getAllUsers() {
  console.log('🔍 Getting all users')
  
  try {
    const snapshot = await db.collection('users').get()
    const allUsers = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }))
    
    // FILTER OUT admins - ONLY employees
    const users = allUsers.filter(user => user.role !== 'admin')
    
    console.log(`📊 Found ${allUsers.length} total users, ${users.length} employees`)
    return users
  } catch (error) {
    console.error('❌ Error getting all users:', error)
    throw error
  }
}

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId) {
  console.log('🔍 Getting user profile:', userId)
  
  try {
    const userDoc = await db.collection('users').doc(userId).get()
    
    if (!userDoc.exists) {
      return null
    }
    
    return { id: userDoc.id, ...userDoc.data() }
  } catch (error) {
    console.error('❌ Error getting user profile:', error)
    throw error
  }
}

/**
 * Update user profile (admin)
 */
export async function updateUserProfile(userId, updates) {
  console.log('✏️ Updating user profile:', userId)
  
  try {
    await db.collection('users').doc(userId).update({
      ...updates,
      updatedAt: new Date().toISOString()
    })
    
    return { success: true }
  } catch (error) {
    console.error('❌ Error updating user profile:', error)
    throw error
  }
}

/**
 * Get daily report for all employees - FIXED to read from attendance collection
 */
// backend/src/services/adminService.js - FIXED getDailyReport to exclude admins

export async function getDailyReport(date) {
  console.log('📊 Getting daily report for:', date)
  
  try {
    // Get ALL users
    const usersSnapshot = await db.collection('users').get()
    const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    
    // FILTER OUT admins - ONLY employees
    const users = allUsers.filter(user => user.role !== 'admin')
    
    console.log(`📊 Found ${allUsers.length} total users, ${users.length} employees`)
    
    const reports = []
    
    for (const user of users) {
      try {
        // Get ALL punches for this user on this date
        const startOfDay = new Date(`${date}T00:00:00.000Z`)
        const endOfDay = new Date(`${date}T23:59:59.999Z`)
        
        const attendanceSnapshot = await db.collection('attendance')
          .where('userId', '==', user.id)
          .where('timestamp', '>=', startOfDay)
          .where('timestamp', '<=', endOfDay)
          .orderBy('timestamp', 'asc')
          .get()
        
        // If no punches, user is No Show
        if (attendanceSnapshot.empty) {
          reports.push({
            userId: user.id,
            user: user,
            date: date,
            punchIn: null,
            punchOut: null,
            currentStatus: 'No Show',
            regularHours: 0,
            overtimeHours: 0,
            nightDiffHours: 0,
            lateMinutes: 0,
            undertimeMinutes: 0,
            totalHours: 0
          })
          continue
        }
        
        const records = attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        
        // Find ALL punch ins and punch outs
        let punchIns = []
        let punchOuts = []
        let latestPunch = null
        let latestPunchTime = null
        
        for (const record of records) {
          let timestamp = record.timestamp
          if (timestamp?.toDate) {
            timestamp = timestamp.toDate()
          } else if (typeof timestamp === 'string') {
            timestamp = new Date(timestamp)
          } else if (!(timestamp instanceof Date)) {
            timestamp = new Date(timestamp)
          }
          
          if (isNaN(timestamp.getTime())) continue
          
          const type = record.type || 'unknown'
          
          // Track latest punch
          if (!latestPunchTime || timestamp > latestPunchTime) {
            latestPunchTime = timestamp
            latestPunch = { id: record.id, type: type, timestamp: timestamp }
          }
          
          if (type === 'in' || type === 'punchIn') {
            punchIns.push({ id: record.id, timestamp: timestamp })
          } else if (type === 'out' || type === 'punchOut') {
            punchOuts.push({ id: record.id, timestamp: timestamp })
          }
        }
        
        // Get FIRST punch in (earliest)
        let firstPunchIn = null
        if (punchIns.length > 0) {
          punchIns.sort((a, b) => a.timestamp - b.timestamp)
          firstPunchIn = punchIns[0]
        }
        
        // Get LAST punch out (latest)
        let lastPunchOut = null
        if (punchOuts.length > 0) {
          punchOuts.sort((a, b) => b.timestamp - a.timestamp)
          lastPunchOut = punchOuts[0]
        }
        
        // Determine current status based on LATEST punch
        let currentStatus = 'No Show'
        if (latestPunch) {
          if (latestPunch.type === 'in' || latestPunch.type === 'punchIn') {
            currentStatus = 'Working'
          } else if (latestPunch.type === 'out' || latestPunch.type === 'punchOut') {
            currentStatus = 'Punched Out'
          }
        }
        
        console.log(`👤 ${user.name}: Latest punch = ${latestPunch?.type}, Status = ${currentStatus}`)
        console.log(`   First In: ${firstPunchIn?.timestamp}, Last Out: ${lastPunchOut?.timestamp}`)
        
        // Calculate metrics using FIRST punch in and LAST punch out
        let regularHours = 0
        let overtimeHours = 0
        let nightDiffHours = 0
        let lateMinutes = 0
        let undertimeMinutes = 0
        
        if (firstPunchIn && lastPunchOut && lastPunchOut.timestamp > firstPunchIn.timestamp) {
          const diffMs = lastPunchOut.timestamp - firstPunchIn.timestamp
          const diffHours = diffMs / (1000 * 60 * 60)
          
          // Regular hours (max 8)
          if (diffHours <= 8) {
            regularHours = diffHours
          } else {
            regularHours = 8
            overtimeHours = diffHours - 8
          }
          
          // Calculate late (if punch in after 9:00 AM)
          const scheduleStart = new Date(firstPunchIn.timestamp)
          scheduleStart.setHours(9, 0, 0, 0)
          if (firstPunchIn.timestamp > scheduleStart) {
            lateMinutes = Math.floor((firstPunchIn.timestamp - scheduleStart) / (1000 * 60))
          }
          
          // Calculate undertime (if punch out before 6:00 PM)
          const scheduleEnd = new Date(lastPunchOut.timestamp)
          scheduleEnd.setHours(18, 0, 0, 0)
          if (lastPunchOut.timestamp < scheduleEnd) {
            undertimeMinutes = Math.floor((scheduleEnd - lastPunchOut.timestamp) / (1000 * 60))
          }
          
          // Calculate night diff (10pm - 6am)
          const nightStart = new Date(firstPunchIn.timestamp)
          nightStart.setHours(22, 0, 0, 0)
          const nightEnd = new Date(lastPunchOut.timestamp)
          nightEnd.setHours(6, 0, 0, 0)
          nightEnd.setDate(nightEnd.getDate() + 1)
          
          if (lastPunchOut.timestamp > nightStart) {
            const nightDiffMs = Math.min(lastPunchOut.timestamp, nightEnd) - Math.max(firstPunchIn.timestamp, nightStart)
            if (nightDiffMs > 0) {
              nightDiffHours = nightDiffMs / (1000 * 60 * 60)
            }
          }
        }
        
        reports.push({
          userId: user.id,
          user: user,
          date: date,
          punchIn: firstPunchIn?.timestamp?.toISOString?.() || firstPunchIn?.timestamp || null,
          punchOut: lastPunchOut?.timestamp?.toISOString?.() || lastPunchOut?.timestamp || null,
          currentStatus: currentStatus,
          regularHours: Math.round(regularHours * 100) / 100,
          overtimeHours: Math.round(overtimeHours * 100) / 100,
          nightDiffHours: Math.round(nightDiffHours * 100) / 100,
          lateMinutes: Math.round(lateMinutes),
          undertimeMinutes: Math.round(undertimeMinutes),
          totalHours: Math.round((regularHours + overtimeHours) * 100) / 100,
          // Additional debug info
          punchCount: records.length,
          punchInCount: punchIns.length,
          punchOutCount: punchOuts.length,
          latestPunchType: latestPunch?.type || null
        })
        
      } catch (err) {
        console.error(`⚠️ Error processing user ${user.id}:`, err)
      }
    }
    
    console.log(`📊 Returning ${reports.length} employee reports`)
    return reports
    
  } catch (error) {
    console.error('❌ Error getting daily report:', error)
    throw error
  }
}
/**
 * Get weekly report for all employees - FIXED
 */
export async function getWeeklyReport(startDate, endDate) {
  console.log('📊 Getting weekly report from:', startDate, 'to:', endDate)
  
  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get()
    const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    
    // FILTER OUT admins - ONLY employees
    const users = allUsers.filter(user => user.role !== 'admin')
    
    console.log(`📊 Found ${allUsers.length} total users, ${users.length} employees`)
    
    const userMap = {}
    
    // For each user, get their attendance for the week
    for (const user of users) {
      // Get all attendance records for this user in date range
      const startOfRange = new Date(`${startDate}T00:00:00.000Z`)
      const endOfRange = new Date(`${endDate}T23:59:59.999Z`)
      
      const attendanceSnapshot = await db.collection('attendance')
        .where('userId', '==', user.id)
        .where('timestamp', '>=', startOfRange)
        .where('timestamp', '<=', endOfRange)
        .orderBy('timestamp', 'asc')
        .get()
      
      if (attendanceSnapshot.empty) {
        continue
      }
      
      // Group by date
      const groupedByDate = {}
      const records = attendanceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      for (const record of records) {
        let timestamp = record.timestamp
        if (timestamp?.toDate) {
          timestamp = timestamp.toDate()
        } else if (typeof timestamp === 'string') {
          timestamp = new Date(timestamp)
        } else if (!(timestamp instanceof Date)) {
          timestamp = new Date(timestamp)
        }
        
        const date = timestamp.toISOString().split('T')[0]
        
        if (!groupedByDate[date]) {
          groupedByDate[date] = {
            punchIn: null,
            punchOut: null
          }
        }
        
        const type = record.type || 'unknown'
        if (type === 'in' || type === 'punchIn') {
          groupedByDate[date].punchIn = timestamp
        } else if (type === 'out' || type === 'punchOut') {
          groupedByDate[date].punchOut = timestamp
        }
      }
      
      // Calculate totals for this user
      let totalRegularHours = 0
      let totalOvertimeHours = 0
      let totalNightDiffHours = 0
      let totalLateMinutes = 0
      let totalUndertimeMinutes = 0
      let totalDays = 0
      const days = []
      
      for (const [date, punches] of Object.entries(groupedByDate)) {
        if (punches.punchIn && punches.punchOut) {
          const diffMs = punches.punchOut - punches.punchIn
          const diffHours = diffMs / (1000 * 60 * 60)
          
          let regularHours = 0
          let overtimeHours = 0
          
          if (diffHours <= 8) {
            regularHours = diffHours
          } else {
            regularHours = 8
            overtimeHours = diffHours - 8
          }
          
          // Night diff calculation
          let nightDiffHours = 0
          const nightStart = new Date(punches.punchIn)
          nightStart.setHours(22, 0, 0, 0)
          const nightEnd = new Date(punches.punchOut)
          nightEnd.setHours(6, 0, 0, 0)
          nightEnd.setDate(nightEnd.getDate() + 1)
          
          if (punches.punchOut > nightStart) {
            const nightDiffMs = Math.min(punches.punchOut, nightEnd) - Math.max(punches.punchIn, nightStart)
            if (nightDiffMs > 0) {
              nightDiffHours = nightDiffMs / (1000 * 60 * 60)
            }
          }
          
          // Late calculation
          let lateMinutes = 0
          const scheduleStart = new Date(punches.punchIn)
          scheduleStart.setHours(9, 0, 0, 0)
          if (punches.punchIn > scheduleStart) {
            lateMinutes = Math.floor((punches.punchIn - scheduleStart) / (1000 * 60))
          }
          
          // Undertime calculation
          let undertimeMinutes = 0
          const scheduleEnd = new Date(punches.punchOut)
          scheduleEnd.setHours(18, 0, 0, 0)
          if (punches.punchOut < scheduleEnd) {
            undertimeMinutes = Math.floor((scheduleEnd - punches.punchOut) / (1000 * 60))
          }
          
          totalRegularHours += Math.round(regularHours * 100) / 100
          totalOvertimeHours += Math.round(overtimeHours * 100) / 100
          totalNightDiffHours += Math.round(nightDiffHours * 100) / 100
          totalLateMinutes += lateMinutes
          totalUndertimeMinutes += undertimeMinutes
          totalDays++
          
          days.push({
            date,
            punchIn: punches.punchIn,
            punchOut: punches.punchOut,
            regularHours: Math.round(regularHours * 100) / 100,
            overtimeHours: Math.round(overtimeHours * 100) / 100,
            nightDiffHours: Math.round(nightDiffHours * 100) / 100,
            lateMinutes,
            undertimeMinutes
          })
        }
      }
      
      if (totalDays > 0) {
        userMap[user.id] = {
          userId: user.id,
          name: user.name || 'Unknown',
          totalDays,
          totalRegularHours: Math.round(totalRegularHours * 100) / 100,
          totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
          totalNightDiffHours: Math.round(totalNightDiffHours * 100) / 100,
          totalLateMinutes,
          totalUndertimeMinutes,
          avgRegularHours: Math.round((totalRegularHours / totalDays) * 100) / 100,
          avgOvertimeHours: Math.round((totalOvertimeHours / totalDays) * 100) / 100,
          days
        }
      }
    }
    
    const report = Object.values(userMap)
    
    console.log(`📊 Weekly report generated for ${report.length} employees`)
    
    return {
      startDate,
      endDate,
      report
    }
    
  } catch (error) {
    console.error('❌ Error getting weekly report:', error)
    throw error
  }
}

/**
 * Get employee's attendance history (admin view) - FIXED to read from attendance collection
 */
export async function getEmployeeAttendance(userId, startDate, endDate) {
  console.log('🔍 Getting employee attendance for userId:', userId)
  console.log('🔍 Date range:', startDate, 'to:', endDate)
  
  try {
    // Get ALL punches for this user
    let query = db.collection('attendance')
      .where('userId', '==', userId)
    
    if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00.000Z`)
      const end = new Date(`${endDate}T23:59:59.999Z`)
      query = query.where('timestamp', '>=', start).where('timestamp', '<=', end)
    }
    
    const snapshot = await query.orderBy('timestamp', 'desc').get()
    
    if (snapshot.empty) {
      console.log('⚠️ No attendance records found for user:', userId)
      return []
    }
    
    // Group by date with actual document IDs
    const groupedByDate = {}
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    
    // First, collect all punches by date with their actual IDs
    for (const record of records) {
      let timestamp = record.timestamp
      if (timestamp?.toDate) {
        timestamp = timestamp.toDate()
      } else if (typeof timestamp === 'string') {
        timestamp = new Date(timestamp)
      } else {
        timestamp = new Date(timestamp)
      }
      
      const date = timestamp.toISOString().split('T')[0]
      
      if (!groupedByDate[date]) {
        groupedByDate[date] = {
          date: date,
          userId: userId,
          punchIn: null,
          punchOut: null,
          punchInId: null,    // Store the actual document ID for first punch in
          punchOutId: null,   // Store the actual document ID for last punch out
          allPunchIns: [],    // Store all punch in IDs
          allPunchOuts: [],   // Store all punch out IDs
          regularHours: 0,
          overtimeHours: 0,
          nightDiffHours: 0,
          lateMinutes: 0,
          undertimeMinutes: 0
        }
      }
      
      const type = record.type || 'unknown'
      if (type === 'in' || type === 'punchIn') {
        groupedByDate[date].allPunchIns.push({
          id: record.id,
          timestamp: timestamp
        })
      } else if (type === 'out' || type === 'punchOut') {
        groupedByDate[date].allPunchOuts.push({
          id: record.id,
          timestamp: timestamp
        })
      }
    }
    
    // Process each date - find FIRST punch in and LAST punch out
    for (const [date, day] of Object.entries(groupedByDate)) {
      // Sort punch ins by time (ascending) - get the FIRST one
      if (day.allPunchIns.length > 0) {
        day.allPunchIns.sort((a, b) => a.timestamp - b.timestamp)
        const firstPunchIn = day.allPunchIns[0]
        day.punchIn = firstPunchIn.timestamp
        day.punchInId = firstPunchIn.id  // Actual document ID of first punch in
      }
      
      // Sort punch outs by time (descending) - get the LAST one
      if (day.allPunchOuts.length > 0) {
        day.allPunchOuts.sort((a, b) => b.timestamp - a.timestamp)
        const lastPunchOut = day.allPunchOuts[0]
        day.punchOut = lastPunchOut.timestamp
        day.punchOutId = lastPunchOut.id  // Actual document ID of last punch out
      }
      
      // Calculate hours using first punch in and last punch out
      if (day.punchIn && day.punchOut) {
        const punchIn = day.punchIn instanceof Date ? day.punchIn : new Date(day.punchIn)
        const punchOut = day.punchOut instanceof Date ? day.punchOut : new Date(day.punchOut)
        const diffMs = punchOut - punchIn
        const diffHours = diffMs / (1000 * 60 * 60)
        
        if (diffHours <= 8) {
          day.regularHours = Math.round(diffHours * 100) / 100
        } else {
          day.regularHours = 8
          day.overtimeHours = Math.round((diffHours - 8) * 100) / 100
        }
        
        // Convert to ISO strings for frontend
        day.punchIn = punchIn.toISOString()
        day.punchOut = punchOut.toISOString()
      }
    }
    
    const history = Object.values(groupedByDate)
      .sort((a, b) => b.date.localeCompare(a.date))
    
    console.log(`✅ Found ${history.length} days of attendance for user`)
    console.log('📊 First day data:', history[0])
    
    return history
    
  } catch (error) {
    console.error('❌ Error getting employee attendance:', error)
    return []
  }
}

/**
 * Edit punch record (admin)
 */
export async function editPunchRecord(punchId, updates) {
  console.log('✏️ Editing punch record with ID:', punchId)
  console.log('✏️ Updates:', JSON.stringify(updates, null, 2))
  
  try {
    // Validate punchId
    if (!punchId) {
      throw new Error('Punch ID is required')
    }
    
    // Get the punch document directly by its ID
    const punchRef = db.collection('attendance').doc(punchId)
    const punchDoc = await punchRef.get()
    
    if (!punchDoc.exists) {
      throw new Error(`Punch record not found: ${punchId}`)
    }
    
    // Get existing data
    const existingData = punchDoc.data()
    console.log('📋 Existing punch data:', { 
      id: punchDoc.id, 
      type: existingData.type, 
      timestamp: existingData.timestamp 
    })
    
    // Build update object - ONLY update the fields provided
    const updateData = {}
    
    // Update timestamp if provided
    if (updates.timestamp) {
      // Make sure timestamp is a valid Date
      const newTimestamp = updates.timestamp instanceof Date 
        ? updates.timestamp 
        : new Date(updates.timestamp)
      
      if (isNaN(newTimestamp.getTime())) {
        throw new Error('Invalid timestamp provided')
      }
      updateData.timestamp = newTimestamp
    }
    
    // NEVER update the type - keep the original type
    // The type should ALWAYS stay as it was (in or out)
    // DO NOT change the type
    // DO NOT add a type field in the update
    
    // Only add updatedAt
    updateData.updatedAt = new Date()
    
    // If there are no fields to update (only updatedAt), throw error
    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields to update')
    }
    
    console.log('📤 Updating with data:', updateData)
    
    await punchRef.update(updateData)
    console.log('✅ Punch record updated successfully:', punchId)
    
    // Return the updated document
    const updatedDoc = await punchRef.get()
    
    return { 
      success: true, 
      id: punchRef.id,
      data: {
        id: punchRef.id,
        ...updatedDoc.data()
      }
    }
    
  } catch (error) {
    console.error('❌ Error editing punch record:', error)
    throw error
  }
}

/**
 * Get employee's daily summary (admin view)
 */
export async function getEmployeeDailySummary(userId, date) {
  console.log('🔍 Getting employee daily summary:', userId, date)
  
  try {
    const startOfDay = new Date(`${date}T00:00:00.000Z`)
    const endOfDay = new Date(`${date}T23:59:59.999Z`)
    
    const snapshot = await db.collection('attendance')
      .where('userId', '==', userId)
      .where('timestamp', '>=', startOfDay)
      .where('timestamp', '<=', endOfDay)
      .orderBy('timestamp', 'asc')
      .get()
    
    if (snapshot.empty) {
      return null
    }
    
    const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    let punchIn = null
    let punchOut = null
    
    for (const record of records) {
      const type = record.type || 'unknown'
      if (type === 'in' || type === 'punchIn') {
        punchIn = record.timestamp
      } else if (type === 'out' || type === 'punchOut') {
        punchOut = record.timestamp
      }
    }
    
    return {
      userId,
      date,
      punchIn: punchIn?.toDate?.()?.toISOString() || punchIn,
      punchOut: punchOut?.toDate?.()?.toISOString() || punchOut
    }
    
  } catch (error) {
    console.error('❌ Error getting employee daily summary:', error)
    return null
  }
}

/**
 * Get employee's punch records (admin view)
 */
export async function getEmployeePunches(userId, startDate, endDate) {
  console.log('🔍 Getting employee punches:', userId)
  
  try {
    let query = db.collection('attendance')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
    
    if (startDate) {
      const start = new Date(`${startDate}T00:00:00.000Z`)
      query = query.where('timestamp', '>=', start)
    }
    
    if (endDate) {
      const end = new Date(`${endDate}T23:59:59.999Z`)
      query = query.where('timestamp', '<=', end)
    }
    
    const snapshot = await query.limit(100).get()
    
    const punches = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }))
    
    return punches
    
  } catch (error) {
    console.error('❌ Error getting employee punches:', error)
    throw error
  }
}