/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('浏览器不支持桌面通知');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const sendBrowserNotification = (title: string, options?: NotificationOptions) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  // Use a default icon if none provided
  const notificationOptions: NotificationOptions = {
    icon: '/favicon.ico',
    ...options,
  };

  try {
    return new Notification(title, notificationOptions);
  } catch (err) {
    console.error('发送通知失败:', err);
  }
};
