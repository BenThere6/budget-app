import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function CurrentSavings({ navigation }) {
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

  // Helper function to format amounts properly, including negative values
  const formatAmount = (amount) => {
    const parsedAmount = parseFloat(amount);
    return parsedAmount < 0 ? `-$${Math.abs(parsedAmount)}` : `$${parsedAmount}`;
  };

  // Fetch savings data from the API and format amounts
  const fetchSavingsData = async () => {
    setIsLoading(true);  // Start loading indicator
    try {
      const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/savings');
      const data = await response.json();

      // Clean and format the fetched data
      const cleanedData = {
        emergency: formatAmount(data.emergency.replace(/[$,]/g, '')),
        general: formatAmount(data.general.replace(/[$,]/g, '')),
        future: formatAmount(data.future.replace(/[$,]/g, '')),
        treatYoSelf: formatAmount(data.treatYoSelf.replace(/[$,]/g, '')),
        vehicle: formatAmount(data.vehicle.replace(/[$,]/g, '')),
        giftsDonations: formatAmount(data.giftsDonations.replace(/[$,]/g, '')),
        travelVacation: formatAmount(data.travelVacation.replace(/[$,]/g, '')),
      };

      setSavingsData(cleanedData);
    } catch (error) {
      console.error('Error fetching savings data:', error);
    } finally {
      setIsLoading(false);  // Stop loading indicator
    }
  };

  // Function to determine the text color based on the amount
  const getAmountStyle = (amount) => {
    const parsedAmount = parseFloat(amount.replace(/[$,]/g, ''));
    return parsedAmount <= 0 ? styles.amountNegative : styles.amountPositive;
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
      <Text style={styles.title}>Current Savings</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color="#000000" />
      ) : (
        <>
          <Text style={styles.text}>
            Emergency: <Text style={getAmountStyle(savingsData.emergency)}>{savingsData.emergency}</Text>
          </Text>
          <Text style={styles.text}>
            General: <Text style={getAmountStyle(savingsData.general)}>{savingsData.general}</Text>
          </Text>
          <Text style={styles.text}>
            Future: <Text style={getAmountStyle(savingsData.future)}>{savingsData.future}</Text>
          </Text>
          <Text style={styles.text}>
            Treat Yo' Self: <Text style={getAmountStyle(savingsData.treatYoSelf)}>{savingsData.treatYoSelf}</Text>
          </Text>
          <Text style={styles.text}>
            Vehicle: <Text style={getAmountStyle(savingsData.vehicle)}>{savingsData.vehicle}</Text>
          </Text>
          <Text style={styles.text}>
            Gifts & Donations: <Text style={getAmountStyle(savingsData.giftsDonations)}>{savingsData.giftsDonations}</Text>
          </Text>
          <Text style={styles.text}>
            Travel/Vacation: <Text style={getAmountStyle(savingsData.travelVacation)}>{savingsData.travelVacation}</Text>
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
  amountPositive: {
    color: 'green', // Green color for positive amounts
    fontWeight: 'bold',
  },
  amountNegative: {
    color: 'red', // Red color for negative or zero amounts
    fontWeight: 'bold',
  },
});