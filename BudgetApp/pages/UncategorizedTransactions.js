import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Button, Alert } from 'react-native';
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
            <Text>{`Details: ${item.details}`}</Text>
            <Text>{`Amount: $${item.amount}`}</Text>
            <Button title="Delete" color="red" onPress={() => confirmDelete(item.id)} />
        </View>
    );

    async function deleteUncategorizedTransaction(rowIndex) {
        const sheets = google.sheets({ version: 'v4', auth: client });
    
        // Get the sheetId for the 'Uncategorized' sheet
        const sheetId = await getSheetId('Uncategorized');
        if (!sheetId) {
            console.error('Failed to retrieve the sheet ID.');
            return;
        }
    
        try {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: '1I__EoadW0ou_wylMFqxkSjrxiXiMrouhBG-Sh5hEsXs',
                resource: {
                    requests: [
                        {
                            deleteDimension: {
                                range: {
                                    sheetId: sheetId,
                                    dimension: 'ROWS',
                                    startIndex: rowIndex - 1, // Assuming rowIndex starts from 1
                                    endIndex: rowIndex,
                                },
                            },
                        },
                    ],
                },
            });
            console.log(`Row ${rowIndex} deleted successfully.`);
        } catch (error) {
            console.error('Error deleting uncategorized transaction:', error);
        }
    }    

    app.delete('/uncategorized-transactions/:rowIndex', async (req, res) => {
        const { rowIndex } = req.params;
    
        try {
            await deleteUncategorizedTransaction(parseInt(rowIndex));
            res.status(200).json({ message: 'Transaction deleted successfully.' });
        } catch (error) {
            console.error('Error deleting uncategorized transaction:', error);
            res.status(500).json({ error: 'Failed to delete transaction.' });
        }
    });    

    return (
        <View style={styles.container}>
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
});