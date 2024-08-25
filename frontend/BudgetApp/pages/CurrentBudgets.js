import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CurrentBudgets() {
  return (
    <View style={styles.container}>
      <Text>Current Budgets Page</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});