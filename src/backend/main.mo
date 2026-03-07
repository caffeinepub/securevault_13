import Principal "mo:core/Principal";
import Array "mo:core/Array";
import List "mo:core/List";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import MixinAuthorization "authorization/MixinAuthorization";
import Time "mo:core/Time";
import AccessControl "authorization/access-control";

actor {
  // Initialize the access control system
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // User profile type
  public type UserProfile = {
    name : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  // User profile management functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Vault entry type
  type VaultEntry = {
    id : Text;
    entryType : Text;
    title : Text;
    encryptedPayload : Text;
    tags : [Text];
    createdAt : Int;
    updatedAt : Int;
  };

  module VaultEntry {
    public func compare(entry1 : VaultEntry, entry2 : VaultEntry) : Order.Order {
      Text.compare(entry1.title, entry2.title);
    };
  };

  let vaultEntries = Map.empty<Principal, Map.Map<Text, VaultEntry>>();

  // Create a new vault entry
  public shared ({ caller }) func createEntry(entryType : Text, title : Text, encryptedPayload : Text, tags : [Text]) : async Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can create vault entries");
    };
    let id = Time.now().toText();
    let timestamp = Time.now();
    let newEntry : VaultEntry = {
      id;
      entryType;
      title;
      encryptedPayload;
      tags;
      createdAt = timestamp;
      updatedAt = timestamp;
    };
    let userEntries = switch (vaultEntries.get(caller)) {
      case (null) {
        let newMap = Map.empty<Text, VaultEntry>();
        newMap;
      };
      case (?existingMap) { existingMap };
    };
    userEntries.add(id, newEntry);
    vaultEntries.add(caller, userEntries);
    id;
  };

  // Get all entries for the caller
  public query ({ caller }) func getEntries() : async [VaultEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access vault entries");
    };
    switch (vaultEntries.get(caller)) {
      case (null) { [] };
      case (?userEntries) { userEntries.values().toArray() };
    };
  };

  // Update an existing entry
  public shared ({ caller }) func updateEntry(id : Text, title : Text, encryptedPayload : Text, tags : [Text]) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update vault entries");
    };
    let userEntries = switch (vaultEntries.get(caller)) {
      case (null) { return false };
      case (?map) { map };
    };
    let existingEntry = switch (userEntries.get(id)) {
      case (null) { return false };
      case (?entry) { entry };
    };
    let updatedEntry : VaultEntry = {
      id;
      entryType = existingEntry.entryType;
      title;
      encryptedPayload;
      tags;
      createdAt = existingEntry.createdAt;
      updatedAt = Time.now();
    };
    userEntries.add(id, updatedEntry);
    true;
  };

  // Delete an entry
  public shared ({ caller }) func deleteEntry(id : Text) : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can delete vault entries");
    };
    switch (vaultEntries.get(caller)) {
      case (null) { false };
      case (?userEntries) {
        if (userEntries.containsKey(id)) {
          userEntries.remove(id);
          true;
        } else {
          false;
        };
      };
    };
  };

  public query ({ caller }) func getEntriesByType(entryType : Text) : async [VaultEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access vault entries");
    };
    let entries = switch (vaultEntries.get(caller)) {
      case (null) { return [] };
      case (?userEntries) { userEntries.values().toArray() };
    };
    let filtered = entries.filter(
      func(entry) { entry.entryType == entryType }
    );
    filtered.sort();
  };

  public query ({ caller }) func getEntriesByTag(tag : Text) : async [VaultEntry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access vault entries");
    };
    let entries = switch (vaultEntries.get(caller)) {
      case (null) { return [] };
      case (?userEntries) { userEntries.values().toArray() };
    };
    let filtered = entries.filter(
      func(entry) { entry.tags.values().any(func(t) { t == tag }) }
    );
    filtered.sort();
  };

  type Migration = {
    name : Text;
    data : ?MigrationData;
    version : Nat;
  };

  type MigrationData = {
    entries : [(Principal, [(Text, VaultEntry)])];
  };

  public shared ({ caller }) func migrate(migration : Migration) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can perform migrations");
    };
    assert (migration.version <= 1);
    assert (migration.name == "personal-vault");
    let data = switch (migration.data) {
      case (null) { return };
      case (?d) { d };
    };
    if (not data.entries.isEmpty()) {
      for ((principal, entries) in data.entries.values()) {
        let newEntries = Map.empty<Text, VaultEntry>();
        for ((id, entry) in entries.values()) {
          newEntries.add(id, entry);
        };
        vaultEntries.add(principal, newEntries);
      };
    };
  };
};
