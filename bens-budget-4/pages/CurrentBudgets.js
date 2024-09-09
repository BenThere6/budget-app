import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons'; // Import Material Icons

export default function CurrentBudgets({ navigation }) {
  const [budgetData, setBudgetData] = useState({
    food: { total: '', used: '', remaining: '' },
    shopping: { total: '', used: '', remaining: '' },
    gas: { total: '', used: '', remaining: '' },
    other: { total: '', used: '', remaining: '' },
    percentMonthPassed: '',
    fillupPrice: 0  // Add the fill-up price here
  });
  const [isLoading, setIsLoading] = useState(true);  // State for loading indicator
  const [toggleDailyBudget, setToggleDailyBudget] = useState(true);  // Default the toggle to true

  const fetchBudgetData = async () => {
    setIsLoading(true);  // Start loading indicator
    try {
      const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/budget');
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

  // Function to calculate how many fillups are left based on the remaining gas budget
  const calculateFillupsLeft = (remainingBudget) => {
    const { fillupPrice } = budgetData;
    return (remainingBudget / fillupPrice).toFixed(2);  // Number of fill-ups left
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
            Food: <Text style={styles.dollarText}>
              {toggleDailyBudget 
                ? formatDollarAmount(getDailyRemainingBudget(budgetData.food)) 
                : formatDollarAmount(budgetData.food.remaining)}
            </Text>
          </Text>
          <Text style={styles.text}>
            Shopping: <Text style={styles.dollarText}>
              {toggleDailyBudget 
                ? formatDollarAmount(getDailyRemainingBudget(budgetData.shopping)) 
                : formatDollarAmount(budgetData.shopping.remaining)}
            </Text>
          </Text>
          <Text style={styles.text}>
            Gas: <Text style={styles.dollarText}>
              {toggleDailyBudget 
                ? calculateFillupsLeft(getDailyRemainingBudget(budgetData.gas)) 
                : calculateFillupsLeft(budgetData.gas.remaining)} fillups
            </Text>
          </Text>
          <Text style={styles.text}>
            Other: <Text style={styles.dollarText}>
              {toggleDailyBudget 
                ? formatDollarAmount(getDailyRemainingBudget(budgetData.other)) 
                : formatDollarAmount(budgetData.other.remaining)}
            </Text>
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
  dollarText: {
    color: 'green',  // Display the dollar amount in green
    fontWeight: 'bold',
  },
});