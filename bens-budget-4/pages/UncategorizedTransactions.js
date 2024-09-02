import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Button, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Modal from 'react-native-modal';

export default function UncategorizedTransactions() {
    const [keyword, setKeyword] = useState('');
    const [category, setCategory] = useState('');
    const [categories, setCategories] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [keywords, setKeywords] = useState([]);  // Local keyword list
    const [isPickerVisible, setPickerVisible] = useState(false);  // State to control Picker visibility
    const [isLoading, setIsLoading] = useState(true);  // State for loading indicator

    const fetchUncategorizedTransactions = async () => {
        setIsLoading(true);  // Start loading indicator
        try {
            const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/uncategorized-transactions');
            const data = await response.json();
            setTransactions(data);
        } catch (error) {
            console.error('Error fetching uncategorized transactions:', error);
        } finally {
            setIsLoading(false);  // Stop loading indicator
        }
    };

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

        const fetchKeywords = async () => {
            try {
                const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/keywords');
                const data = await response.json();
                setKeywords(data);  // Set the initial keyword list
            } catch (error) {
                console.error('Error fetching keywords:', error);
            }
        };

        fetchKeywords();

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

                    setKeywords(prevKeywords => [...prevKeywords, [keyword, category]]);
                    deleteMatchingTransactions(keyword);
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

    const deleteMatchingTransactions = async (newKeyword) => {
        const matchingTransactions = transactions.filter(transaction => 
            transaction.details.includes(newKeyword)
        );
    
        // Loop over all matching transactions and delete them
        for (let i = 0; i < matchingTransactions.length; i++) {
            const transaction = matchingTransactions[i];
            
            try {
                const response = await fetch(`https://budgetapp-dc6bcd57eaee.herokuapp.com/uncategorized-transactions/${transaction.id}`, {
                    method: 'DELETE',
                });
    
                if (response.ok) {
                    console.log(`Transaction with ID ${transaction.id} deleted successfully!`);
                    setTransactions(prevTransactions => 
                        prevTransactions.filter(t => t.id !== transaction.id)
                    );
                } else {
                    console.error(`Failed to delete transaction with ID ${transaction.id}.`);
                }
            } catch (error) {
                console.error(`Error deleting transaction with ID ${transaction.id}:`, error.message);
            }
        }
    };
    
    const renderTransaction = ({ item }) => (
        <View style={styles.transactionItem}>
            <Text style={styles.transactionDetails}>
                {item.details}
            </Text>
            <Text style={styles.transactionAmount}>{`$${item.amount}`}</Text>
        </View>
    );    

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#000000" />
                    <Text>Fetching Transactions...</Text>
                </View>
            ) : (
                <FlatList
                    data={transactions}
                    renderItem={renderTransaction}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.transactionList}
                />
            )}
            <View style={styles.footerContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Enter Keyword"
                    value={keyword}
                    onChangeText={setKeyword}
                />
                <TouchableOpacity style={styles.pickerButton} onPress={() => setPickerVisible(true)}>
                    <Text style={styles.pickerButtonText}>
                        {category ? category : "Select a Category"}
                    </Text>
                </TouchableOpacity>
                <Button title="Save Keyword & Category" onPress={handleSave} />
            </View>
            <Modal
                isVisible={isPickerVisible}
                onBackdropPress={() => setPickerVisible(false)}
                style={styles.modal}
            >
                <View style={styles.pickerModal}>
                    <Picker
                        selectedValue={category}
                        onValueChange={(itemValue) => setCategory(itemValue)}
                    >
                        <Picker.Item label="Select a Category" value="" />
                        {categories.map((cat, index) => (
                            <Picker.Item key={index} label={cat} value={cat} />
                        ))}
                    </Picker>
                    <Button title="Done" onPress={() => setPickerVisible(false)} />
                </View>
            </Modal>
            <Button title="Refresh" onPress={fetchUncategorizedTransactions} />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        flex: 1,
        marginRight: 10,
        flexWrap: 'wrap', // Allow the text to wrap if it's too long
    },
    transactionAmount: {
        width: 70,
        textAlign: 'left',
    },
    footerContainer: {
        flexDirection: 'column',
        justifyContent: 'flex-end',
    },
    input: {
        height: 40,
        borderColor: 'gray',
        borderWidth: 1,
        marginBottom: 10,
        paddingLeft: 8,
    },
    pickerButton: {
        height: 40,
        justifyContent: 'center',
        backgroundColor: '#ddd',
        marginBottom: 10,
        paddingLeft: 8,
    },
    pickerButtonText: {
        fontSize: 16,
    },
    modal: {
        justifyContent: 'flex-end',
        margin: 0,
    },
    pickerModal: {
        backgroundColor: 'white',
        padding: 20,
    },
});