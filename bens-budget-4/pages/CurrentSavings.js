import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function CurrentSavings({ navigation }) {
  const [savingsData, setSavingsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const formatAmount = (amount) => {
    const parsedAmount = parseFloat(amount);
    return parsedAmount < 0 ? `-$${Math.abs(parsedAmount).toFixed(2)}` : `$${parsedAmount.toFixed(2)}`;
  };

  const fetchSavingsData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/savings');
      const data = await response.json();

      const cleanedData = Object.keys(data).map(category => ({
        name: data[category].name,
        amount: formatAmount(data[category].amount.replace(/[$,]/g, ''))
      }));

      setSavingsData(cleanedData);
    } catch (error) {
      console.error('Error fetching savings data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAmountStyle = (amount) => {
    const parsedAmount = parseFloat(amount.replace(/[$,]/g, ''));
    return parsedAmount <= 0 ? styles.amountNeutral : styles.amountPositive;
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={fetchSavingsData}>
          <MaterialIcons name="refresh" size={24} color="black" style={{ marginRight: 15 }} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    fetchSavingsData();
  }, []);

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
          {savingsData.map((item, index) => (
            <View style={styles.tableRow} key={index}>
              <Text style={styles.cellText}>{item.name}</Text>
              <Text style={[styles.cellText, getAmountStyle(item.amount)]}>{item.amount}</Text>
            </View>
          ))}
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
  amountNeutral: {
    color: 'gray',
    fontWeight: 'bold',
  },
});