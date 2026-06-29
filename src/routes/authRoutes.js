import express from 'express'

const router = express.Router()

// Get current user info
router.get('/me', async (req, res) => {
  try {
    // This will be implemented with auth middleware
    res.json({
      success: true,
      message: 'Auth routes working'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

export default router