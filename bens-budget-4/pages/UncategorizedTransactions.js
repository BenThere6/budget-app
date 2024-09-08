import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, Button, Text, ScrollView, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Modal from 'react-native-modal';
import { MaterialIcons } from '@expo/vector-icons';

// Get device height
const { height: screenHeight } = Dimensions.get('window');

export default function UncategorizedTransactions({ navigation }) {
    const [keyword, setKeyword] = useState('');
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState(''); 
    const [keywords, setKeywords] = useState([]);  
    const [categories, setCategories] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [isPickerVisible, setPickerVisible] = useState(false);  
    const [isLoading, setIsLoading] = useState(true);  
    const [isKeywordModalVisible, setKeywordModalVisible] = useState(false); 

    // Fetch uncategorized transactions
    const fetchUncategorizedTransactions = async () => {
        setIsLoading(true); 
        try {
            const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/uncategorized-transactions');
            const data = await response.json();
            setTransactions(data);
        } catch (error) {
            console.error('Error fetching uncategorized transactions:', error);
        } finally {
            setIsLoading(false);  
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/categories');
            const data = await response.json();
            setCategories(data);
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchKeywords = async () => {
        try {
            const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/keywords');
            const data = await response.json();

            if (data.length > 0) {
                setKeywords(data); // Include all rows, including the first one
            } else {
                setKeywords([]); 
            }
        } catch (error) {
            console.error('Error fetching keywords:', error);
        }
    };

    const deleteKeyword = async (keywordToDelete) => {
        try {
            const response = await fetch(`https://budgetapp-dc6bcd57eaee.herokuapp.com/delete-keyword`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ keyword: keywordToDelete }),
            });

            if (response.ok) {
                alert('Keyword deleted successfully!');
                setKeywords(prevKeywords => prevKeywords.filter(k => k.keyword !== keywordToDelete));
            } else {
                const errorText = await response.text();
                alert(`Failed to delete keyword. Error: ${errorText}`);
            }
        } catch (error) {
            console.error('Error deleting keyword:', error);
        }
    };

    useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: () => (
                <TouchableOpacity onPress={() => setKeywordModalVisible(true)}>
                    <MaterialIcons name="menu" size={24} color="black" style={{ marginLeft: 15 }} />
                </TouchableOpacity>
            ),
            headerRight: () => (
                <TouchableOpacity onPress={fetchUncategorizedTransactions}>
                    <MaterialIcons name="refresh" size={24} color="black" style={{ marginRight: 15 }} />
                </TouchableOpacity>
            ),
        });
    }, [navigation]);

    useEffect(() => {
        fetchUncategorizedTransactions();
        fetchCategories();  
    }, []);

    useEffect(() => {
        if (isKeywordModalVisible) {
            fetchKeywords();  
        }
    }, [isKeywordModalVisible]);

    const handleSave = async () => {
        if (keyword && category) {
            try {
                const response = await fetch('https://budgetapp-dc6bcd57eaee.herokuapp.com/save-keyword', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        keyword,
                        category,
                        amount: amount || null 
                    }),
                });

                if (response.ok) {
                    alert('Keyword, Category, and Amount saved successfully!');
                    setKeyword('');
                    setCategory('');
                    setAmount(''); 

                    setKeywords(prevKeywords => [...prevKeywords, { keyword, category, amount }]);
                    deleteMatchingTransactions(keyword);
                } else {
                    const errorText = await response.text(); 
                    alert(`Failed to save. Try again. Error: ${errorText}`);
                }
            } catch (error) {
                console.error('Error during saving:', error); 
                alert(`Error: ${error.message}`);
            }
        } else {
            alert('Please enter both a keyword and a category.');
        }
    };

    const deleteMatchingTransactions = async (newKeyword) => {
        const matchingTransactions = transactions
            .map((transaction, index) => ({ ...transaction, originalIndex: index }))
            .filter(transaction => {
                const keywordMatch = transaction.details.includes(newKeyword);
                const amountMatch = !amount || transaction.amount === amount;
                return keywordMatch && amountMatch;
            });

        matchingTransactions.sort((a, b) => b.originalIndex - a.originalIndex);

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
                    const errorText = await response.text();
                    console.error(`Failed to delete transaction with ID ${transaction.id}. Error: ${errorText}`);
                }
            } catch (error) {
                console.error(`Error deleting transaction with ID ${transaction.id}:`, error.message);
            }
        }
    };

    // Render each transaction item
    const renderTransaction = ({ item, index }) => {
        const isHeader = index === -1; // -1 to remove this logic. Not needed.

        return (
            <View style={styles.transactionRow}>
                <Text style={[styles.transactionDetails, isHeader && styles.boldText]}>
                    {item.details}
                </Text>
                <Text style={[styles.transactionAmount, isHeader && styles.boldText, isHeader ? styles.blackText : styles.greenText]}>
                    {isHeader ? item.amount : `$${item.amount}`}
                </Text>
            </View>
        );
    };

    const renderKeywordItem = ({ item, index }) => (
        <View style={styles.keywordRow}>
            <View style={styles.keywordColumn}>
                <ScrollView horizontal>
                    <Text style={styles.keywordText}>{item.keyword}</Text>
                </ScrollView>
            </View>
            <View style={styles.categoryColumn}>
                <ScrollView horizontal>
                    <Text style={styles.categoryText}>{item.category}</Text>
                </ScrollView>
            </View>
            <View style={styles.iconColumn}>
                <TouchableOpacity onPress={() => deleteKeyword(item.keyword)}>
                    <MaterialIcons name="delete" size={24} color="red" />
                </TouchableOpacity>
            </View>
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
                <>
                    {/* Fixed first row (header) */}
                    {transactions.length > 0 && (
                        <View style={styles.transactionRow}>
                            <Text style={[styles.transactionDetails, styles.boldText]}>
                                {transactions[0].details}
                            </Text>
                            <Text style={[styles.transactionAmount, styles.boldText, styles.blackText]}>
                                {transactions[0].amount}
                            </Text>
                        </View>
                    )}

                    {/* Scrollable transaction list */}
                    <FlatList
                        data={transactions.slice(1)} // Skip the first row
                        renderItem={renderTransaction}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={styles.transactionList}
                    />
                </>
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
                <TextInput
                    style={styles.input} 
                    placeholder="Enter Amount (optional)"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                />
                <Button title="Save Keyword & Category" onPress={handleSave} />
            </View>

            {/* Modal for selecting category */}
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

            {/* Modal for viewing and deleting keywords */}
            <Modal
                isVisible={isKeywordModalVisible}
                onBackdropPress={() => setKeywordModalVisible(false)}
                style={styles.modal}
            >
                <View style={[styles.keywordModal, { maxHeight: screenHeight - 100 }]}>
                    {/* Fixed first row */}
                    <View style={styles.keywordRow}>
                        <View style={styles.keywordColumn}>
                            <Text style={[styles.keywordText, styles.boldText]}>{keywords.length > 0 && keywords[0].keyword}</Text>
                        </View>
                        <View style={styles.categoryColumn}>
                            <Text style={[styles.categoryText, styles.boldText]}>{keywords.length > 0 && keywords[0].category}</Text>
                        </View>
                        <View style={styles.iconColumn}>
                            <MaterialIcons name="delete" size={24} color="transparent" />
                        </View>
                    </View>

                    {/* Scrollable list */}
                    <FlatList
                        data={keywords.slice(1)}  // Skip the first row
                        renderItem={renderKeywordItem}
                        keyExtractor={(item, index) => `${item.keyword}-${index}`}
                    />

                    <Button title="Close" onPress={() => setKeywordModalVisible(false)} />
                </View>
            </Modal>

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
        justifyContent: 'center',
        margin: 0,
    },
    pickerModal: {
        backgroundColor: 'white',
        padding: 20,
    },
    keywordModal: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
    },
    keywordRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    keywordColumn: {
        width: '50%',
        marginRight: '5%',
    },
    categoryColumn: {
        width: '35%',
    },
    iconColumn: {
        width: '10%',
        alignItems: 'center',
    },
    keywordText: {
        fontSize: 14,
    },
    categoryText: {
        fontSize: 14,
    },
    boldText: {
        fontWeight: 'bold',
    },
    transactionRow: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    transactionDetails: {
        fontSize: 16,
        flex: 1,
    },
    transactionAmount: {
        fontSize: 16,
        color: 'green',
    },
    blackText: {
        color: 'black',
    },
});