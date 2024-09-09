import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function CurrentBudgets({ navigation }) {
  const [budgetData, setBudgetData] = useState({
    food: { total: 0, used: 0, remaining: 0 },
    shopping: { total: 0, used: 0, remaining: 0 },
    gas: { total: 0, used: 0, remaining: 0 },
    other: { total: 0, used: 0, remaining: 0 },
    percentMonthPassed: 0,
    fillupPrice: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [toggleDailyBudget, setToggleDailyBudget] = useState(true);

  const fetchBudgetData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/budget');
      const data = await response.json();

      const parsedData = {
        ...data,
        food: { ...data.food, remaining: Math.round(parseFloat(data.food.remaining)) },
        shopping: { ...data.shopping, remaining: Math.round(parseFloat(data.shopping.remaining)) },
        gas: { ...data.gas, remaining: Math.round(parseFloat(data.gas.remaining)) },
        other: { ...data.other, remaining: Math.round(parseFloat(data.other.remaining)) },
      };

      setBudgetData(parsedData);
    } catch (error) {
      console.error('Error fetching budget data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDollarAmount = (amount) => {
    const parsedAmount = parseFloat(amount);
    return parsedAmount < 0 ? `-$${Math.abs(Math.round(parsedAmount))}` : `$${Math.round(parsedAmount)}`;
  };

  // Updated function to apply gray style for negative or zero amounts (daily or monthly)
  const getAmountStyle = (category, isDaily) => {
    const amount = isDaily ? getDailyRemainingBudget(category) : category.remaining;
    return parseFloat(amount) > 0 ? styles.amountPositive : styles.amountNegative;
  };

  // Updated function to apply gray style for gas fillups < 1 (daily or monthly)
  const getGasStyle = (category, isDaily) => {
    const fillups = isDaily ? calculateFillupsLeft(getDailyRemainingBudget(category)) : calculateFillupsLeft(category.remaining);
    return parseFloat(fillups) >= 1 ? styles.amountPositive : styles.amountNegative;
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

  const getDailyRemainingBudget = (category) => {
    const { total, used } = category;
    const allowedToUse = (budgetData.percentMonthPassed / 100) * total;
    const remaining = allowedToUse - used;
    return remaining > 0 ? Math.round(remaining) : 0;
  };

  const calculateFillupsLeft = (remainingBudget) => {
    const { fillupPrice } = budgetData;
    const fillupsLeft = remainingBudget / fillupPrice;
    return fillupsLeft.toFixed(2);
  };

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator size="large" color="#000000" />
      ) : (
        <>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableRow}>
              <Text style={styles.headerText}>Category</Text>
              <Text style={styles.headerText}>Amount</Text>
            </View>

            {/* Table Rows */}
            <View style={styles.tableRow}>
              <Text style={styles.cellText}>Food</Text>
              <Text style={getAmountStyle(budgetData.food, toggleDailyBudget)}>
                {toggleDailyBudget
                  ? formatDollarAmount(getDailyRemainingBudget(budgetData.food))
                  : formatDollarAmount(budgetData.food.remaining)}
              </Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.cellText}>Shopping</Text>
              <Text style={getAmountStyle(budgetData.shopping, toggleDailyBudget)}>
                {toggleDailyBudget
                  ? formatDollarAmount(getDailyRemainingBudget(budgetData.shopping))
                  : formatDollarAmount(budgetData.shopping.remaining)}
              </Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.cellText}>Gas</Text>
              <Text style={getGasStyle(budgetData.gas, toggleDailyBudget)}>
                {toggleDailyBudget
                  ? `${calculateFillupsLeft(getDailyRemainingBudget(budgetData.gas))} fillups`
                  : `${calculateFillupsLeft(budgetData.gas.remaining)} fillups`}
              </Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={styles.cellText}>Other</Text>
              <Text style={getAmountStyle(budgetData.other, toggleDailyBudget)}>
                {toggleDailyBudget
                  ? formatDollarAmount(getDailyRemainingBudget(budgetData.other))
                  : formatDollarAmount(budgetData.other.remaining)}
              </Text>
            </View>
          </View>

          {/* Toggle at the bottom */}
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>Daily Budget</Text>
            <Switch
              value={toggleDailyBudget}
              onValueChange={() => setToggleDailyBudget(!toggleDailyBudget)}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between', // Makes sure content is spread, toggle will be at the bottom
  },
  table: {
    flex: 1, // Takes up available space above the toggle
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  cellText: {
    fontSize: 16,
  },
  amountPositive: {
    color: 'green',
    fontWeight: 'bold',
  },
  amountNegative: {
    color: 'gray',  // Gray color for negative/neutral amounts
    fontWeight: 'bold',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  toggleLabel: {
    fontSize: 16,
    marginRight: 10,
  },
});