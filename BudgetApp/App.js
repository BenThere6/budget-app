import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import CurrentBudgets from './pages/CurrentBudgets';
import CurrentSavings from './pages/CurrentSavings';
import UncategorizedTransactions from './pages/UncategorizedTransactions';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Budgets" component={CurrentBudgets} />
        <Tab.Screen name="Savings" component={CurrentSavings} />
        <Tab.Screen name="Uncategorized" component={UncategorizedTransactions} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}