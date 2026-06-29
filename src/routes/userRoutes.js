import express from 'express'
import { 
  createProfile, 
  getProfile, 
  updateProfile 
} from '../controllers/userController.js'

const router = express.Router()

// Create user profile - POST /api/users/:uid/profile
router.post('/:uid/profile', createProfile)

// Get user profile - GET /api/users/:uid/profile
router.get('/:uid/profile', getProfile)

// Update user profile - PUT /api/users/:uid/profile
router.put('/:uid/profile', updateProfile)

export default router
