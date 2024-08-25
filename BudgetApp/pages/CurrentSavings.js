import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CurrentSavings() {
  const [savingsData, setSavingsData] = useState({
    emergency: '',
    general: '',
    future: '',
    treatYoSelf: '',
    vehicle: '',
    giftsDonations: '',
    travelVacation: ''
  });

  useEffect(() => {
    const fetchSavingsData = async () => {
      try {
        const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/savings');
        const data = await response.json();
        setSavingsData(data);
      } catch (error) {
        console.error('Error fetching savings data:', error);
      }
    };

    fetchSavingsData();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Current Savings</Text>
      <Text style={styles.text}>Emergency: {savingsData.emergency}</Text>
      <Text style={styles.text}>General: {savingsData.general}</Text>
      <Text style={styles.text}>Future: {savingsData.future}</Text>
      <Text style={styles.text}>Treat Yo' Self: {savingsData.treatYoSelf}</Text>
      <Text style={styles.text}>Vehicle: {savingsData.vehicle}</Text>
      <Text style={styles.text}>Gifts & Donations: {savingsData.giftsDonations}</Text>
      <Text style={styles.text}>Travel/Vacation: {savingsData.travelVacation}</Text>
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