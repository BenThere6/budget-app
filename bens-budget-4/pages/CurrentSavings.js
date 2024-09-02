import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator } from 'react-native';

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
  const [isLoading, setIsLoading] = useState(true);  // State for loading indicator

  const fetchSavingsData = async () => {
    setIsLoading(true);  // Start loading indicator
    try {
      const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/savings');
      const data = await response.json();
      setSavingsData(data);
    } catch (error) {
      console.error('Error fetching savings data:', error);
    } finally {
      setIsLoading(false);  // Stop loading indicator
    }
  };

  useEffect(() => {
    fetchSavingsData();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Current Savings</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color="#000000" />
      ) : (
        <>
          <Text style={styles.text}>Emergency: {savingsData.emergency}</Text>
          <Text style={styles.text}>General: {savingsData.general}</Text>
          <Text style={styles.text}>Future: {savingsData.future}</Text>
          <Text style={styles.text}>Treat Yo' Self: {savingsData.treatYoSelf}</Text>
          <Text style={styles.text}>Vehicle: {savingsData.vehicle}</Text>
          <Text style={styles.text}>Gifts & Donations: {savingsData.giftsDonations}</Text>
          <Text style={styles.text}>Travel/Vacation: {savingsData.travelVacation}</Text>
        </>
      )}
      <Button title="Refresh" onPress={fetchSavingsData} />
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