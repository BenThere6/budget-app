import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, Text, View, FlatList, Button, Alert, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export default function App() {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    setCategories(['Food', 'Shopping', 'Utilities']);
    setTransactions([
      { id: 1, details: 'Grocery Shopping', amount: '50.00' },
      { id: 2, details: 'Electricity Bill', amount: '75.00' }
    ]);
  }, []);

  const handleSave = () => {
    if (keyword && category) {
      Alert.alert('Keyword and Category saved successfully!');
      setKeyword('');
      setCategory('');
    } else {
      Alert.alert('Please enter both a keyword and a category.');
    }
  };

  const confirmDelete = (id) => {
    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to delete this transaction?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => handleDelete(id) }
      ]
    );
  };

  const handleDelete = (id) => {
    setTransactions(transactions.filter(transaction => transaction.id !== id));
    Alert.alert('Transaction deleted successfully!');
  };

  const renderTransaction = ({ item }) => (
    <View style={styles.transactionItem}>
      <Text style={styles.transactionDetails}>
        {item.details.length > 50 ? `${item.details.substring(0, 50)}...` : item.details}
      </Text>
      <Text style={styles.transactionAmount}>{`$${item.amount}`}</Text>
      <Button title="Delete" color="red" onPress={() => confirmDelete(item.id)} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter Keyword"
          value={keyword}
          onChangeText={setKeyword}
        />
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={category}
            style={styles.picker}
            onValueChange={(itemValue) => setCategory(itemValue)}
          >
            <Picker.Item label="Select a Category" value="" />
            {categories.map((cat, index) => (
              <Picker.Item key={index} label={cat} value={cat} />
            ))}
          </Picker>
        </View>
        <Button title="Save Keyword & Category" onPress={handleSave} />
      </View>
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.transactionList}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  headerContainer: {
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingLeft: 8,
  },
  pickerWrapper: {
    marginBottom: 20,
    height: 40, // Standard height for input field
    justifyContent: 'center',
  },
  picker: {
    height: 40,
    width: '100%',
  },
  transactionList: {
    flexGrow: 1,
  },
  transactionItem: {
    padding: 10,
    borderBottomColor: 'gray',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionDetails: {
    flexShrink: 1,
    maxWidth: '60%',
  },
  transactionAmount: {
    marginRight: 10,
  },
});