// backend/src/routes/attendanceRoutes.js
import express from 'express'
import { verifyAuth } from '../middlewares/auth.js'
import {
  punchIn,
  punchOut,
  getTodayAttendance,
  getHistory,
  getPunchStatus,
  getActiveStats
} from '../controllers/attendanceController.js'

const router = express.Router()

// All routes require authentication
router.use(verifyAuth)

// Punch in/out
router.post('/punch-in', punchIn)
router.post('/punch-out', punchOut)

// Get data
router.get('/today', getTodayAttendance)
router.get('/history', getHistory)
router.get('/status', getPunchStatus)
router.get('/active-stats', getActiveStats)

export default router