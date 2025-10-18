// Consumer of UserService
package main

import "fmt"

// UserManager manages a UserService
type UserManager struct {
	service *UserService
}

// NewUserManager creates a new UserManager
func NewUserManager() *UserManager {
	return &UserManager{
		service: NewUserService(),
	}
}

// Initialize sets up the manager with default data
func (m *UserManager) Initialize() {
	defaultUser := CreateDefaultUser()
	m.service.AddUser(defaultUser)

	adminUser := User{
		ID:    1,
		Name:  "Admin",
		Email: "admin@example.com",
	}
	m.service.AddUser(adminUser)
}

// GetUser retrieves a user by ID
func (m *UserManager) GetUser(id int) *User {
	return m.service.FindUserByID(id)
}

// ListAll returns all users
func (m *UserManager) ListAll() []User {
	return m.service.GetAllUsers()
}

func runManager() {
	manager := NewUserManager()
	manager.Initialize()

	user := manager.GetUser(1)
	if user != nil {
		fmt.Printf("Found user: %s\n", user.Name)
	}
}
