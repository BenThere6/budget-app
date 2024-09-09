import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons'; // Import Material Icons

export default function CurrentBudgets({ navigation }) {
  const [budgetData, setBudgetData] = useState({
    food: { total: '', used: '', remaining: '' },
    shopping: { total: '', used: '', remaining: '' },
    gas: { total: '', used: '', remaining: '' },
    other: { total: '', used: '', remaining: '' },
    percentMonthPassed: ''
  });
  const [isLoading, setIsLoading] = useState(true);  // State for loading indicator
  const [toggleDailyBudget, setToggleDailyBudget] = useState(false);  // State for toggle

  const fetchBudgetData = async () => {
    setIsLoading(true);  // Start loading indicator
    try {
      const response = await fetch('https://your-backend-url/budget/');
      const data = await response.json();
      setBudgetData(data);
    } catch (error) {
      console.error('Error fetching budget data:', error);
    } finally {
      setIsLoading(false);  // Stop loading indicator
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={fetchBudgetData}>
          <MaterialIcons name="refresh" size={24} color="black" style={{ marginRight: 15 }} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    fetchBudgetData();
  }, []);

  // Function to calculate the allowed remaining budget based on the percentage of the month passed
  const getDailyRemainingBudget = (category) => {
    const { total, used } = category;
    const allowedToUse = (budgetData.percentMonthPassed / 100) * total;
    const remaining = allowedToUse - used;
    return remaining > 0 ? remaining.toFixed(2) : 0;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Current Budgets</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color="#000000" />
      ) : (
        <>
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Daily Budget</Text>
            <Switch
              value={toggleDailyBudget}
              onValueChange={() => setToggleDailyBudget(!toggleDailyBudget)}
            />
          </View>
          <Text style={styles.text}>
            Food: {toggleDailyBudget ? getDailyRemainingBudget(budgetData.food) : budgetData.food.remaining}
          </Text>
          <Text style={styles.text}>
            Shopping: {toggleDailyBudget ? getDailyRemainingBudget(budgetData.shopping) : budgetData.shopping.remaining}
          </Text>
          <Text style={styles.text}>
            Gas: {toggleDailyBudget ? getDailyRemainingBudget(budgetData.gas) : budgetData.gas.remaining}
          </Text>
          <Text style={styles.text}>
            Other: {toggleDailyBudget ? getDailyRemainingBudget(budgetData.other) : budgetData.other.remaining}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  text: {
    fontSize: 18,
    marginBottom: 10,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  toggleLabel: {
    fontSize: 16,
    marginRight: 10,
  },
});