package com.example;

import java.util.List;

/**
 * Manages a UserService instance
 */
public class UserManager {
    private UserService service;

    public UserManager() {
        this.service = new UserService();
    }

    /**
     * Initialize the manager with default data
     */
    public void initialize() {
        User defaultUser = UserService.createDefaultUser();
        service.addUser(defaultUser);

        User adminUser = new User(1, "Admin", "admin@example.com");
        service.addUser(adminUser);
    }

    /**
     * Get a user by ID
     */
    public User getUser(int id) {
        return service.findUserById(id);
    }

    /**
     * Get all users
     */
    public List<User> listAll() {
        return service.getAllUsers();
    }

    public static void main(String[] args) {
        UserManager manager = new UserManager();
        manager.initialize();

        User user = manager.getUser(1);
        if (user != null) {
            System.out.println("Found user: " + user.getName());
        }
    }
}

