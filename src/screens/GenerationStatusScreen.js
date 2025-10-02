import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

export default function GenerationStatusScreen({ route, navigation }) {
  const { generationId } = route.params;
  const [generation, setGeneration] = useState({ status: 'processing' });

  useEffect(() => {
    const channel = supabase
      .channel(`generation-status-${generationId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', schema: 'public', table: 'generations', filter: `id=eq.${generationId}` 
      }, (payload) => {
          setGeneration(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [generationId]);

  const handleSaveImage = async () => {
    if (!generation?.output_image_url) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission Denied', 'We need permission to save photos.');
      const fileUri = FileSystem.cacheDirectory + `${new Date().getTime()}.png`;
      const { uri } = await FileSystem.downloadAsync(generation.output_image_url, fileUri);
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync('Proompt', asset, false);
      Alert.alert('Saved!', 'Image saved to your photo library.');
    } catch(e) { Alert.alert('Error', 'Could not save image.'); }
  }

  const renderContent = () => {
    if (generation.status === 'processing') {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#f4511e" />
          <Text style={styles.statusText}>AI is working its magic...</Text>
          <Text style={styles.subText}>This can take a minute. Your result will appear here automatically.</Text>
        </View>
      );
    }
    if (generation.status === 'succeeded') {
      return (
        <>
          <Text style={styles.title}>Here's Your Creation!</Text>
          <Image source={{ uri: generation.output_image_url }} style={styles.image} />
          <TouchableOpacity style={styles.button} onPress={handleSaveImage}>
            <Text style={styles.buttonText}>Save to Device</Text>
          </TouchableOpacity>
        </>
      );
    }
    if (generation.status === 'failed') {
      return (
        <View style={styles.centerContent}>
          <Text style={styles.statusText}>Generation Failed</Text>
          <Text style={styles.errorText}>{generation.error_message || 'An unknown error occurred.'}</Text>
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderContent()}
      <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => navigation.popToTop()}>
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>Create Another</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20, justifyContent: 'space-between' },
    centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    statusText: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
    subText: { fontSize: 16, color: '#666', marginTop: 10, textAlign: 'center' },
    errorText: { fontSize: 14, color: 'red', marginTop: 10, textAlign: 'center' },
    title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 20 },
    image: { width: '100%', aspectRatio: 1, borderRadius: 16, marginBottom: 20 },
    button: { width: '100%', padding: 15, borderRadius: 30, backgroundColor: '#f4511e', alignItems: 'center' },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    secondaryButton: { backgroundColor: '#eee', marginTop: 10 },
    secondaryButtonText: { color: '#333' },
});