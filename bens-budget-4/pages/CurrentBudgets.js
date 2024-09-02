import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons'; // Import Material Icons

export default function CurrentBudgets({ navigation }) {
  const [budgetData, setBudgetData] = useState({
    food: '',
    shopping: '',
    gas: '',
    other: ''
  });
  const [isLoading, setIsLoading] = useState(true);  // State for loading indicator

  const fetchBudgetData = async () => {
    setIsLoading(true);  // Start loading indicator
    try {
      const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/budget/');
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Current Budgets</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color="#000000" />
      ) : (
        <>
          <Text style={styles.text}>Food: {budgetData.food}</Text>
          <Text style={styles.text}>Shopping: {budgetData.shopping}</Text>
          <Text style={styles.text}>Gas: {budgetData.gas}</Text>
          <Text style={styles.text}>Other: {budgetData.other}</Text>
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
});