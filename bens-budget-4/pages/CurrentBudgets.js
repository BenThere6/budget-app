import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CurrentBudgets() {
  const [budgetData, setBudgetData] = useState({
    food: '',
    shopping: '',
    gas: '',
    other: ''
  });

  useEffect(() => {
    const fetchBudgetData = async () => {
      try {
        const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/budget/');
        const data = await response.json();
        setBudgetData(data);
      } catch (error) {
        console.error('Error fetching budget data:', error);
      }
    };

    fetchBudgetData();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Current Budgets</Text>
      <Text style={styles.text}>Food: {budgetData.food}</Text>
      <Text style={styles.text}>Shopping: {budgetData.shopping}</Text>
      <Text style={styles.text}>Gas: {budgetData.gas}</Text>
      <Text style={styles.text}>Other: {budgetData.other}</Text>
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
});