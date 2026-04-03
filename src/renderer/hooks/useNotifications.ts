import { useState, useEffect, useCallback } from 'react'
import type { Notification, NewNotification } from '../../shared/types'

export function useNotifications(firstName: string, lastName: string) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await window.electronAPI.getStudentNotifications(firstName, lastName)
    setNotifications(data)
    setLoading(false)
  }, [firstName, lastName])

  useEffect(() => {
    load()
  }, [load])

  const add = useCallback(async (notification: NewNotification) => {
    await window.electronAPI.addNotification(notification)
    await load()
  }, [load])

  const remove = useCallback(async (id: number) => {
    await window.electronAPI.deleteNotification(id)
    await load()
  }, [load])

  return { notifications, loading, add, remove, reload: load }
}
