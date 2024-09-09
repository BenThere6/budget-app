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

  const getAmountStyle = (amount) => {
    return parseFloat(amount) <= 0 ? styles.amountNegative : styles.amountPositive;
  };

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
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableRow}>
            <Text style={styles.headerText}>Category</Text>
            <Text style={styles.headerText}>Amount</Text>
          </View>

          {/* Table Rows */}
          <View style={styles.tableRow}>
            <Text style={styles.cellText}>Food</Text>
            <Text style={getAmountStyle(budgetData.food.remaining)}>
              {toggleDailyBudget
                ? formatDollarAmount(getDailyRemainingBudget(budgetData.food))
                : formatDollarAmount(budgetData.food.remaining)}
            </Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.cellText}>Shopping</Text>
            <Text style={getAmountStyle(budgetData.shopping.remaining)}>
              {toggleDailyBudget
                ? formatDollarAmount(getDailyRemainingBudget(budgetData.shopping))
                : formatDollarAmount(budgetData.shopping.remaining)}
            </Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.cellText}>Gas</Text>
            <Text style={getGasStyle(calculateFillupsLeft(budgetData.gas.remaining))}>
              {toggleDailyBudget
                ? `${calculateFillupsLeft(getDailyRemainingBudget(budgetData.gas))} fillups`
                : `${calculateFillupsLeft(budgetData.gas.remaining)} fillups`}
            </Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={styles.cellText}>Other</Text>
            <Text style={getAmountStyle(budgetData.other.remaining)}>
              {toggleDailyBudget
                ? formatDollarAmount(getDailyRemainingBudget(budgetData.other))
                : formatDollarAmount(budgetData.other.remaining)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  table: {
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
    color: 'gray',
    fontWeight: 'bold',
  },
});