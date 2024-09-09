import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons'; // Import Material Icons

export default function CurrentBudgets({ navigation }) {
  const [budgetData, setBudgetData] = useState({
    food: { total: 0, used: 0, remaining: 0 },
    shopping: { total: 0, used: 0, remaining: 0 },
    gas: { total: 0, used: 0, remaining: 0 },
    other: { total: 0, used: 0, remaining: 0 },
    percentMonthPassed: 0,
    fillupPrice: 0  // Add the fill-up price here
  });
  const [isLoading, setIsLoading] = useState(true);  // State for loading indicator
  const [toggleDailyBudget, setToggleDailyBudget] = useState(true);  // Default the toggle to true

  const fetchBudgetData = async () => {
    setIsLoading(true);  // Start loading indicator
    try {
      const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/budget');
      const data = await response.json();
      
      // Ensure the values are properly parsed as numbers
      const parsedData = {
        ...data,
        food: { ...data.food, remaining: Math.round(parseFloat(data.food.remaining)) },
        shopping: { ...data.shopping, remaining: Math.round(parseFloat(data.shopping.remaining)) },
        gas: { ...data.gas, remaining: Math.round(parseFloat(data.gas.remaining)) },
        other: { ...data.other, remaining: Math.round(parseFloat(data.other.remaining)) }
      };

      setBudgetData(parsedData);
    } catch (error) {
      console.error('Error fetching budget data:', error);
    } finally {
      setIsLoading(false);  // Stop loading indicator
    }
  };
  
  const formatDollarAmount = (amount) => {
    const parsedAmount = parseFloat(amount);
    return parsedAmount < 0 ? `-$${Math.abs(Math.round(parsedAmount))}` : `$${Math.round(parsedAmount)}`;
  };

  // Function to determine the text color based on the amount
  const getAmountStyle = (amount) => {
    return parseFloat(amount) <= 0 ? styles.amountNegative : styles.amountPositive;
  };

  // Function to determine the text color for gas based on the number of fillups
  const getGasStyle = (fillups) => {
    return parseFloat(fillups) < 1 ? styles.amountNegative : styles.amountPositive;
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
    return remaining > 0 ? Math.round(remaining) : 0;
  };

  // Function to calculate how many fillups are left based on the remaining gas budget
  const calculateFillupsLeft = (remainingBudget) => {
    const { fillupPrice } = budgetData;
    const fillupsLeft = remainingBudget / fillupPrice;
    return fillupsLeft.toFixed(2);  // Number of fill-ups left with 2 decimal places
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
            Food: <Text style={getAmountStyle(toggleDailyBudget ? getDailyRemainingBudget(budgetData.food) : budgetData.food.remaining)}>
              {toggleDailyBudget 
                ? formatDollarAmount(getDailyRemainingBudget(budgetData.food)) 
                : formatDollarAmount(budgetData.food.remaining)}
            </Text>
          </Text>
          <Text style={styles.text}>
            Shopping: <Text style={getAmountStyle(toggleDailyBudget ? getDailyRemainingBudget(budgetData.shopping) : budgetData.shopping.remaining)}>
              {toggleDailyBudget 
                ? formatDollarAmount(getDailyRemainingBudget(budgetData.shopping)) 
                : formatDollarAmount(budgetData.shopping.remaining)}
            </Text>
          </Text>
          <Text style={styles.text}>
            Gas: <Text style={getGasStyle(calculateFillupsLeft(toggleDailyBudget ? getDailyRemainingBudget(budgetData.gas) : budgetData.gas.remaining))}>
              {toggleDailyBudget 
                ? `${calculateFillupsLeft(getDailyRemainingBudget(budgetData.gas))} fillups` 
                : `${calculateFillupsLeft(budgetData.gas.remaining)} fillups`}
            </Text>
          </Text>
          <Text style={styles.text}>
            Other: <Text style={getAmountStyle(toggleDailyBudget ? getDailyRemainingBudget(budgetData.other) : budgetData.other.remaining)}>
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
  amountPositive: {
    color: 'green',  // Display the positive amount in green
    fontWeight: 'bold',
  },
  amountNegative: {
    color: 'red',  // Display the negative amount in red
    fontWeight: 'bold',
  },
});