// src/screens/HomeScreen.js
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, FlatList, ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import TemplateCard from '../components/TemplateCard';

// HomeScreen receives the `navigation` prop directly from the Navigator
export default function HomeScreen({ navigation }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching templates:', error);
    } else {
      setTemplates(data);
    }
    setLoading(false);
  };

  // This is the function that contains the navigation logic.
  const handleSelectTemplate = (template) => {
    navigation.navigate('Upload', { template: template });
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Choose a Trend</Text>
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id.toString()}
        // For each item, we render a TemplateCard.
        // We pass the `onSelect` prop, which is a function that calls
        // our handleSelectTemplate with the specific item.
        renderItem={({ item }) => (
          <TemplateCard item={item} onSelect={() => handleSelectTemplate(item)} />
        )}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
  },
  list: {
    paddingHorizontal: 20,
  },
});