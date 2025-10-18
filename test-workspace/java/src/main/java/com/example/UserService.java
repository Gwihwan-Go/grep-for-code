package com.example;

import java.util.ArrayList;
import java.util.List;

/**
 * Service for managing users
 */
public class UserService {
    private List<User> users;

    public UserService() {
        this.users = new ArrayList<>();
    }

    /**
     * Add a user to the service
     */
    public void addUser(User user) {
        users.add(user);
    }

    /**
     * Find a user by ID
     */
    public User findUserById(int id) {
        for (User user : users) {
            if (user.getId() == id) {
                return user;
            }
        }
        return null;
    }

    /**
     * Get all users
     */
    public List<User> getAllUsers() {
        return new ArrayList<>(users);
    }

    /**
     * Get the number of users
     */
    public int getUserCount() {
        return users.size();
    }

    /**
     * Create a default guest user
     */
    public static User createDefaultUser() {
        return new User(0, "Guest", "guest@example.com");
    }
}

