import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Button, Alert, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export default function UncategorizedTransactions() {
    const [keyword, setKeyword] = useState('');
    const [category, setCategory] = useState('');
    const [categories, setCategories] = useState([]);
    const [transactions, setTransactions] = useState([]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/categories');
                const data = await response.json();
                setCategories(data);
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        };

        fetchCategories();
    }, []);

    useEffect(() => {
        const fetchUncategorizedTransactions = async () => {
            try {
                const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/uncategorized-transactions');
                const data = await response.json();
                setTransactions(data);
            } catch (error) {
                console.error('Error fetching uncategorized transactions:', error);
            }
        };

        fetchUncategorizedTransactions();
    }, []);

    const handleSave = async () => {
        if (keyword && category) {
            try {
                const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/save-keyword', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ keyword, category }),
                });

                if (response.ok) {
                    alert('Keyword and Category saved successfully!');
                    setKeyword('');
                    setCategory('');
                } else {
                    alert('Failed to save. Try again.');
                }
            } catch (error) {
                alert('Error:', error.message);
            }
        } else {
            alert('Please enter both a keyword and a category.');
        }
    };

    const handleDelete = async (id) => {
        try {
            const response = await fetch(`https://budgetapp-dc6bcd57eaee.herokuapp.com/uncategorized-transactions/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                alert('Transaction deleted successfully!');
                setTransactions(transactions.filter(transaction => transaction.id !== id));
            } else {
                alert('Failed to delete transaction. Try again.');
            }
        } catch (error) {
            alert('Error:', error.message);
        }
    };

    const confirmDelete = (id) => {
        Alert.alert(
            "Delete Transaction",
            "Are you sure you want to delete this transaction?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => handleDelete(id)
                }
            ]
        );
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
        <View style={styles.container}>
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
        </View>
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
        marginBottom: 170,
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