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
        name="Budgets"
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
        name="Savings"
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
        name="Uncategorized"
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
    registerForPushNotificationsAsync().then(token => {
      setExpoPushToken(token);
      if (token) {
        sendTokenToServer(token); // Store the token on your backend server
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response received:', response);
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const sendTokenToServer = async (token) => {
    try {
      await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
    } catch (error) {
      console.error('Failed to send token to server:', error);
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
        })}
        tabBarOptions={{
          activeTintColor: 'tomato',
          inactiveTintColor: 'gray',
        }}
      >
        <Tab.Screen name="Budgets" component={BudgetsStack} />
        <Tab.Screen name="Savings" component={SavingsStack} />
        <Tab.Screen name="Uncategorized" component={UncategorizedStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

async function registerForPushNotificationsAsync() {
  let token;
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }

    token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'd00c5c45-b878-4373-b1cd-0b6a67e1e3e7',
    })).data;

    console.log(token);
  } else {
    alert('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}