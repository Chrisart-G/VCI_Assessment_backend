import { db } from '../config/firebase.js'
import { getDailySummary, getWeeklySummary } from '../services/attendanceService.js'
import { getTodayDate } from '../utils/timeHelpers.js'

/**
 * Get daily summary for a user
 */
export const getDailySummaryForUser = async (req, res) => {
  try {
    const userId = req.user.uid
    // Check both route param and query param
    let summaryDate = req.params.date || req.query.date
    
    if (!summaryDate) {
      summaryDate = getTodayDate()
    }
    
    console.log(`📊 Getting daily summary for user ${userId} on date ${summaryDate}`)
    
    const summary = await getDailySummary(userId, summaryDate)
    
    res.json({
      success: true,
      data: summary || null,
      message: summary ? 'Summary found' : 'No summary for this date'
    })
  } catch (error) {
    console.error('❌ Error getting daily summary:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Get weekly summary for a user
 */
export const getWeeklySummaryForUser = async (req, res) => {
  try {
    const userId = req.user.uid
    const { startDate, endDate } = req.query
    
    // Default to last 7 days
    const end = endDate || getTodayDate()
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    console.log(`📊 Getting weekly summary for user ${userId} from ${start} to ${end}`)
    
    const summary = await getWeeklySummary(userId, start, end)
    
    res.json({
      success: true,
      data: summary,
      period: { start, end }
    })
  } catch (error) {
    console.error('❌ Error getting weekly summary:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}

/**
 * Get all daily summaries for a user (history)
 */
export const getUserHistory = async (req, res) => {
  try {
    const userId = req.user.uid
    const { limit = 30 } = req.query
    
    console.log(`📊 Getting history for user ${userId} with limit ${limit}`)
    
    const snapshot = await db.collection('dailySummary')
      .where('userId', '==', userId)
      .orderBy('date', 'desc')
      .limit(parseInt(limit))
      .get()
    
    const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    
    res.json({
      success: true,
      data: history,
      count: history.length
    })
  } catch (error) {
    console.error('❌ Error getting user history:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
}