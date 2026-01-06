export const fixture = `
AsyncStorage.setItem('auth_token', 'not-a-real-token')

Linking.getInitialURL()
Linking.openURL('https://example.com')
WebBrowser.openBrowserAsync('https://example.com')

fetch('http://insecure.example.com')

console.log('token', 'not-a-real-token')

Math.random()

Notifications.getExpoPushTokenAsync()
`
