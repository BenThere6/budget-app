import React, { useState, useEffect, useRef } from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import CurrentBudgets from './pages/CurrentBudgets';
import CurrentSavings from './pages/CurrentSavings';
import UncategorizedTransactions from './pages/UncategorizedTransactions';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
});

// Set up Notification Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Initialize Navigators
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Custom header component with a refresh button
function CustomHeader({ title, onRefresh }) {
  return {
    headerTitle: title,
    headerRight: () => (
      <TouchableOpacity onPress={onRefresh}>
        <MaterialIcons name="refresh" size={24} color="black" style={{ marginRight: 10 }} />
      </TouchableOpacity>
    ),
  };
}

// Screens wrapped in Stack Navigators with custom headers
function BudgetsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="BudgetsScreen"
        component={CurrentBudgets}
        options={({ navigation }) => CustomHeader({ title: 'Budgets', onRefresh: () => navigation.setParams({ refresh: true }) })}
      />
    </Stack.Navigator>
  );
}

function SavingsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SavingsScreen"
        component={CurrentSavings}
        options={({ navigation }) => CustomHeader({ title: 'Savings', onRefresh: () => navigation.setParams({ refresh: true }) })}
      />
    </Stack.Navigator>
  );
}

function UncategorizedStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="UncategorizedScreen"
        component={UncategorizedTransactions}
        options={({ navigation }) => CustomHeader({ title: 'Uncategorized', onRefresh: () => navigation.setParams({ refresh: true }) })}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    const updatePushToken = async () => {
      const newToken = await registerForPushNotificationsAsync();
  
      if (newToken) {
        setExpoPushToken(newToken); // Store it in state to display in UI
        const storedToken = await AsyncStorage.getItem('pushToken');
        console.log('📌 Stored Token:', storedToken);
        console.log('📌 New Token:', newToken);
  
        if (storedToken !== newToken) {
          console.log('🔄 New device detected, updating token...');
          await AsyncStorage.setItem('pushToken', newToken);
          await sendTokenToServer(newToken); // Send only if different
        }
      }
    };
  
    updatePushToken();
  }, []);  

  const sendTokenToServer = async (token) => {
    try {
      console.log('🚀 Sending token to server:', token);
      const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
  
      const responseData = await response.json();
      console.log('✅ Server Response:', responseData);
  
      if (!response.ok) {
        throw new Error('❌ Failed to send token to server');
      }
    } catch (error) {
      console.error('❌ Error sending token:', error);
    }
  };
  
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false, // Disable the header for the Tab.Navigator
          tabBarIcon: ({ color, size }) => {
            let iconName;

            if (route.name === 'Budgets') {
              iconName = 'attach-money';
            } else if (route.name === 'Savings') {
              iconName = 'savings';
            } else if (route.name === 'Uncategorized') {
              iconName = 'receipt';
            }

            return <MaterialIcons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: 'tomato',
          tabBarInactiveTintColor: 'gray',
        })}
      >
        <Tab.Screen name="Budgets" component={BudgetsStack} />
        <Tab.Screen name="Savings" component={SavingsStack} />
        <Tab.Screen name="Uncategorized" component={UncategorizedStack} />
      </Tab.Navigator>
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 16 }}>Push Token:</Text>
        <Text selectable style={{ fontWeight: 'bold' }}>
          {expoPushToken || 'Fetching...'}
        </Text>
        <Button title="Check Console" onPress={() => console.log('🔹 Push Token:', expoPushToken)} />
      </View>
    </NavigationContainer>
  );
}

async function registerForPushNotificationsAsync() {
  let token;
  try {
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.error('❌ Notification permissions not granted');
        alert('Failed to get push token for push notification!');
        return null;
      }

      token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'd00c5c45-b878-4373-b1cd-0b6a67e1e3e7',
      })).data;

      console.log('✅ New push token received:', token);
    } else {
      alert('Must use a physical device for Push Notifications');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  } catch (error) {
    console.error('❌ Error fetching push token:', error);
  }

  return token;
}