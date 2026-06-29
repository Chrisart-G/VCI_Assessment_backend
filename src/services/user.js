const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export const userService = {
  async createProfile(uid, profileData) {
    console.log('📝 userService.createProfile called')
    console.log('📝 UID:', uid)
    console.log('📝 Sending data:', JSON.stringify(profileData, null, 2))

    try {
      const response = await fetch(`${API_BASE}/users/${uid}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      })

      const data = await response.json()
      console.log('📝 createProfile response:', data)
      return data
    } catch (error) {
      console.error('❌ userService.createProfile error:', error)
      return { success: false, error: error.message }
    }
  },

  async getProfile(uid) {
    console.log('📝 userService.getProfile called for:', uid)

    try {
      const response = await fetch(`${API_BASE}/users/${uid}/profile`)
      const data = await response.json()
      console.log('📝 getProfile response:', data)
      return data
    } catch (error) {
      console.error('❌ userService.getProfile error:', error)
      return { success: false, error: error.message }
    }
  },

  async updateProfile(uid, updates) {
    console.log('✏️ userService.updateProfile called for:', uid)

    try {
      const response = await fetch(`${API_BASE}/users/${uid}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      const data = await response.json()
      return data
    } catch (error) {
      console.error('❌ userService.updateProfile error:', error)
      return { success: false, error: error.message }
    }
  },
}