// backend/src/controllers/adminController.js
import { 
  getAllUsers,
  getUserProfile,
  updateUserProfile,
  getDailyReport,
  getWeeklyReport,
  getEmployeeAttendance,
  editPunchRecord,
  getEmployeeDailySummary,
  getEmployeePunches
} from '../services/adminService.js'

/**
 * Get all users (employees)
 */
export const getUsers = async (req, res) => {
  try {
    const users = await getAllUsers()
    
    res.json({
      success: true,
      data: users
    })
  } catch (error) {
    console.error('❌ Get users error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Get user profile (admin view)
 */
export const getUserProfileById = async (req, res) => {
  try {
    const { userId } = req.params
    
    const user = await getUserProfile(userId)
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }
    
    res.json({
      success: true,
      data: user
    })
  } catch (error) {
    console.error('❌ Get user profile error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Update user profile (admin)
 */
export const updateUserProfileById = async (req, res) => {
  try {
    const { userId } = req.params
    const updates = req.body
    
    const result = await updateUserProfile(userId, updates)
    
    res.json({
      success: true,
      message: 'User profile updated successfully',
      data: result
    })
  } catch (error) {
    console.error('❌ Update user profile error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Get daily report
 */
export const getDailyReportController = async (req, res) => {
  try {
    const { date } = req.query
    const reportDate = date || new Date().toISOString().split('T')[0]
    
    console.log('📊 Getting daily report for date:', reportDate)
    
    const report = await getDailyReport(reportDate)
    
    console.log('📊 Report data:', JSON.stringify(report, null, 2))
    
    res.json({
      success: true,
      data: report
    })
  } catch (error) {
    console.error('❌ Get daily report error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Get weekly report
 */
export const getWeeklyReportController = async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    
    // Default to current week
    const now = new Date()
    const start = startDate || (() => {
      const d = new Date(now)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      d.setDate(diff)
      return d.toISOString().split('T')[0]
    })()
    
    const end = endDate || (() => {
      const d = new Date(now)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? 0 : 7 - day)
      d.setDate(diff)
      return d.toISOString().split('T')[0]
    })()
    
    const report = await getWeeklyReport(start, end)
    
    res.json({
      success: true,
      data: report
    })
  } catch (error) {
    console.error('❌ Get weekly report error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Get employee's attendance (admin view)
 */
export const getEmployeeAttendanceController = async (req, res) => {
  try {
    const { userId } = req.params
    const { startDate, endDate } = req.query
    
    console.log('🔍 Getting attendance for user:', userId, 'from:', startDate, 'to:', endDate)
    
    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      })
    }
    
    const history = await getEmployeeAttendance(userId, startDate, endDate)
    
    console.log('📊 Found attendance records:', history.length)
    
    res.json({
      success: true,
      data: history
    })
  } catch (error) {
    console.error('❌ Get employee attendance error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch employee attendance'
    })
  }
}

/**
 * Get employee's daily summary (admin view)
 */
export const getEmployeeDailySummaryController = async (req, res) => {
  try {
    const { userId } = req.params
    const { date } = req.query
    const summaryDate = date || new Date().toISOString().split('T')[0]
    
    const summary = await getEmployeeDailySummary(userId, summaryDate)
    
    res.json({
      success: true,
      data: summary
    })
  } catch (error) {
    console.error('❌ Get employee daily summary error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Get employee's punches (admin view)
 */
export const getEmployeePunchesController = async (req, res) => {
  try {
    const { userId } = req.params
    const { startDate, endDate } = req.query
    
    const punches = await getEmployeePunches(userId, startDate, endDate)
    
    res.json({
      success: true,
      data: punches
    })
  } catch (error) {
    console.error('❌ Get employee punches error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Edit punch record (admin)
 */
export const editPunchController = async (req, res) => {
  try {
    const { punchId } = req.params
    const updates = req.body
    
    // Validate - only timestamp should be updated
    if (!updates.timestamp) {
      return res.status(400).json({
        success: false,
        message: 'Timestamp is required for updating punch'
      })
    }
    
    console.log('✏️ Edit punch request:', { punchId, updates })
    
    const result = await editPunchRecord(punchId, updates)
    
    res.json({
      success: true,
      message: 'Punch record updated successfully',
      data: result
    })
  } catch (error) {
    console.error('❌ Edit punch error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}