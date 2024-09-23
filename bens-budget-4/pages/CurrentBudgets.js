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

  const getAmountStyle = (category, isDaily) => {
    const amount = isDaily ? getDailyRemainingBudget(category) : category.remaining;
    return parseFloat(amount) > 0 ? styles.amountPositive : styles.amountNegative;
  };

  const getGasStyle = (category, isDaily) => {
    const remainingBudget = isDaily ? getDailyRemainingBudget(category) : category.remaining;
    const fillups = calculateFillupsLeft(remainingBudget);
  
    // Display in gray if fill-ups are less than 1, otherwise use positive style
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

            {/* Food Budget */}
            <View style={styles.tableRow}>
              <Text style={styles.cellText}>Food</Text>
              <Text style={getAmountStyle(budgetData.food, toggleDailyBudget)}>
                {toggleDailyBudget
                  ? formatDollarAmount(getDailyRemainingBudget(budgetData.food))
                  : formatDollarAmount(budgetData.food.remaining)}
              </Text>
            </View>

            {/* Shopping Budget */}
            <View style={styles.tableRow}>
              <Text style={styles.cellText}>Shopping</Text>
              <Text style={getAmountStyle(budgetData.shopping, toggleDailyBudget)}>
                {toggleDailyBudget
                  ? formatDollarAmount(getDailyRemainingBudget(budgetData.shopping))
                  : formatDollarAmount(budgetData.shopping.remaining)}
              </Text>
            </View>

            {/* Gas Budget */}
            <View style={styles.tableRow}>
              <Text style={styles.cellText}>Gas</Text>
              <Text style={getGasStyle(budgetData.gas, toggleDailyBudget)}>
                {toggleDailyBudget
                  ? `${formatDollarAmount(getDailyRemainingBudget(budgetData.gas))} / ${calculateFillupsLeft(getDailyRemainingBudget(budgetData.gas))} fillups`
                  : `${formatDollarAmount(budgetData.gas.remaining)} / ${calculateFillupsLeft(budgetData.gas.remaining)} fillups`}
              </Text>
            </View>

            {/* Other Budget */}
            <View style={styles.tableRow}>
              <Text style={styles.cellText}>Other</Text>
              <Text style={getAmountStyle(budgetData.other, toggleDailyBudget)}>
                {toggleDailyBudget
                  ? formatDollarAmount(getDailyRemainingBudget(budgetData.other))
                  : formatDollarAmount(budgetData.other.remaining)}
              </Text>
            </View>
          </View>

          {/* Toggle for Daily Budget */}
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
    justifyContent: 'space-between',
  },
  table: {
    flex: 1,
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