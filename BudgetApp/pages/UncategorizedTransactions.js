import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Button } from 'react-native';
import { Picker } from '@react-native-picker/picker';

export default function UncategorizedTransactions() {
    const [keyword, setKeyword] = useState('');
    const [category, setCategory] = useState('');
    const [categories, setCategories] = useState([]);
    const [transactions, setTransactions] = useState([]);

    // Fetch categories on component mount
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

    // Fetch uncategorized transactions on component mount
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

    const renderTransaction = ({ item }) => (
        <View style={styles.transactionItem}>
            <Text>{`Details: ${item.details}`}</Text>
            <Text>{`Amount: $${item.amount}`}</Text>
        </View>
    );

    return (
        <FlatList
            data={transactions}
            renderItem={renderTransaction}
            keyExtractor={item => item.id.toString()}
            ListHeaderComponent={
                <View style={styles.headerContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter Keyword"
                        value={keyword}
                        onChangeText={setKeyword}
                    />
                    <Picker
                        selectedValue={category}
                        style={styles.input}
                        onValueChange={(itemValue) => setCategory(itemValue)}
                    >
                        <Picker.Item label="Select a Category" value="" />
                        {categories.map((cat, index) => (
                            <Picker.Item key={index} label={cat} value={cat} />
                        ))}
                    </Picker>
                    <Button title="Save Keyword & Category" onPress={handleSave} />
                </View>
            }
            contentContainerStyle={styles.container}
        />
    );
}

const styles = StyleSheet.create({
    container: {
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
    transactionItem: {
        padding: 10,
        borderBottomColor: 'gray',
        borderBottomWidth: 1,
    },
});