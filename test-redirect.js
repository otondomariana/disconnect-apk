const { makeRedirectUri } = require('expo-auth-session');
const url1 = makeRedirectUri({ native: 'com.scheme:/oauth2redirect' });
const url2 = makeRedirectUri({ native: 'com.scheme:/oauth2redirect', path: 'login' });
console.log('URL1:', url1);
console.log('URL2:', url2);
