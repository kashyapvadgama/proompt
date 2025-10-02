import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

export default function ResultScreen({ route, navigation }) {
  const { base64Image } = route.params;
  const imageUri = `data:image/png;base64,${base64Image}`;

  const handleSaveImage = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need permission to save photos to your device.');
        return;
      }

      const fileUri = FileSystem.documentDirectory + `${new Date().getTime()}.png`;
      await FileSystem.writeAsStringAsync(fileUri, base64Image, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const asset = await MediaLibrary.createAssetAsync(fileUri);
      await MediaLibrary.createAlbumAsync('Proompt', asset, false);
      Alert.alert('Saved!', 'Your image has been saved to the Proompt album in your photos.');
    } catch (error) {
      console.error('Save image error:', error);
      Alert.alert('Error', 'Could not save the image.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Here's Your Creation!</Text>
      <View style={styles.imageContainer}>
        {base64Image ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        ) : (
            <Text>Image could not be loaded.</Text>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={handleSaveImage}>
          <Text style={styles.buttonText}>Save to Device</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={() => navigation.popToTop()} // Go back to the home screen
        >
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Create Another</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'space-around' },
  title: { fontSize: 24, fontWeight: 'bold', marginTop: 20 },
  imageContainer: { width: '90%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  buttonContainer: { width: '90%', marginBottom: 20 },
  button: { padding: 15, borderRadius: 30, backgroundColor: '#f4511e', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  secondaryButton: { backgroundColor: '#eee' },
  secondaryButtonText: { color: '#333' },
});