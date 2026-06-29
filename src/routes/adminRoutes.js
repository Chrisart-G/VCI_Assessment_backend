// backend/src/routes/adminRoutes.js
import express from 'express'
import { verifyAuth, checkAdmin } from '../middlewares/auth.js'
import {
  getUsers,
  getUserProfileById,
  updateUserProfileById,
  getDailyReportController,
  getWeeklyReportController,
  getEmployeeAttendanceController,
  getEmployeeDailySummaryController,
  getEmployeePunchesController,
  editPunchController
} from '../controllers/adminController.js'

const router = express.Router()

// All admin routes require authentication AND admin role
router.use(verifyAuth, checkAdmin)

// User management
router.get('/users', getUsers)
router.get('/user/:userId/profile', getUserProfileById)
router.put('/user/:userId/profile', updateUserProfileById)

// Reports
router.get('/daily-report', getDailyReportController)
router.get('/weekly-report', getWeeklyReportController)

// Employee data (admin view)
router.get('/user/:userId/attendance', getEmployeeAttendanceController)
router.get('/user/:userId/daily-summary', getEmployeeDailySummaryController)
router.get('/user/:userId/punches', getEmployeePunchesController)

// Edit punches
router.put('/punch/:punchId', editPunchController)

export default router