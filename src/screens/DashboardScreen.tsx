import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

const mockNews = [
  {
    id: "1",
    title: "YSRCP MLA Tatiparthi Chandrasekhar",
    category: "Politics",
    date: "Oct 29 2025",
    status: "draft",
  },
  {
    id: "2",
    title: "Minister for Education Adimulapu Suresh",
    category: "Education",
    date: "Oct 30 2025",
    status: "submitted",
  },
  {
    id: "3",
    title: "Opposition Leader Nara Chandrababu Naidu Press Conference",
    category: "Politics",
    date: "Oct 31 2025",
    status: "approved",
  },
  {
    id: "4",
    title: "Health Minister Tummala Nageswara Rao on COVID-19 Updates",
    category: "Health",
    date: "Nov 1 2025",
    status: "approved",
  },
];

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState("");
  const [newsData, setNewsData] = useState(mockNews);

  const filteredData = newsData.filter((n) =>
    n.title.toLowerCase().includes(searchText.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "#FFC107";
      case "submitted":
        return "#8BC34A";
      case "approved":
        return "#9C27B0";
      default:
        return "#ccc";
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => navigation.navigate("Login"),
      },
    ]);
  };

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <View>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>
            {item.category} · {item.date} · {item.status}
          </Text>
        </View>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.name}>Rohit Venka Kumar</Text>
          <Text style={styles.location}>Hyderabad</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="menu" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      <TextInput
        placeholder="Search news..."
        style={styles.searchBar}
        placeholderTextColor="#aaa"
        value={searchText}
        onChangeText={setSearchText}
      />

      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", paddingHorizontal: 12 },
  header: {
    backgroundColor: "#222",
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  location: { color: "#FDD835", fontSize: 13 },
  searchBar: {
    marginVertical: 12,
    backgroundColor: "#f6f6f6",
    borderRadius: 10,
    padding: 10,
    color: "#000",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginVertical: 6,
    elevation: 2,
  },
  title: { fontWeight: "bold", color: "#000" },
  meta: { fontSize: 12, color: "#555", marginTop: 4 },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignSelf: "center",
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
});
