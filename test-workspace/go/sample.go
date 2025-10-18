// Sample Go code for testing LSP functionality
package main

import (
	"fmt"
)

// User represents a user in the system
type User struct {
	ID    int
	Name  string
	Email string
}

// UserService manages users
type UserService struct {
	users []User
}

// NewUserService creates a new UserService
func NewUserService() *UserService {
	return &UserService{
		users: make([]User, 0),
	}
}

// AddUser adds a user to the service
func (s *UserService) AddUser(user User) {
	s.users = append(s.users, user)
}

// FindUserByID finds a user by ID
func (s *UserService) FindUserByID(id int) *User {
	for i := range s.users {
		if s.users[i].ID == id {
			return &s.users[i]
		}
	}
	return nil
}

// GetAllUsers returns all users
func (s *UserService) GetAllUsers() []User {
	result := make([]User, len(s.users))
	copy(result, s.users)
	return result
}

// GetUserCount returns the number of users
func (s *UserService) GetUserCount() int {
	return len(s.users)
}

// CreateDefaultUser creates a default guest user
func CreateDefaultUser() User {
	return User{
		ID:    0,
		Name:  "Guest",
		Email: "guest@example.com",
	}
}

func main() {
	service := NewUserService()
	defaultUser := CreateDefaultUser()
	service.AddUser(defaultUser)

	fmt.Printf("Total users: %d\n", service.GetUserCount())
}
