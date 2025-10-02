// App.js

// Must be the first import to polyfill crypto.getRandomValues
import 'react-native-get-random-values';

// All other imports go below
import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './src/screens/HomeScreen';
import UploadScreen from './src/screens/UploadScreen';
import ResultScreen from './src/screens/ResultScreen';
import GenerationStatusScreen from './src/screens/GenerationStatusScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#f4511e',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="ProomptHome"
          component={HomeScreen}
          options={{ title: 'Proompt' }}
        />
        <Stack.Screen
          name="Upload"
          component={UploadScreen}
          options={({ route }) => ({ title: route.params.template.name })}
        />
        <Stack.Screen
          name="Result"
          component={ResultScreen}
          options={{ title: 'Your Masterpiece' }}
        />
                <Stack.Screen name="GenerationStatus" component={GenerationStatusScreen} options={{ title: 'Generating...' }} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}