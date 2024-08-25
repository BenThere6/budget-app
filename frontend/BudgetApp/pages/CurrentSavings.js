import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CurrentSavings() {
  return (
    <View style={styles.container}>
      <Text>Current Savings Page</Text>
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