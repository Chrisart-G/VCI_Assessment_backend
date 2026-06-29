import express from 'express'
import { verifyAuth } from '../middlewares/auth.js'
import {
  getDailySummaryForUser,
  getWeeklySummaryForUser,
  getUserHistory
} from '../controllers/dailySummaryController.js'

const router = express.Router()

// All routes require authentication
router.use(verifyAuth)

// Get daily summary - use query parameter instead of optional route param
router.get('/daily', getDailySummaryForUser)

// Get daily summary for specific date (alternative using query param)
router.get('/daily/:date', getDailySummaryForUser)

// Get weekly summary
router.get('/weekly', getWeeklySummaryForUser)

// Get user history
router.get('/history', getUserHistory)

export default router