#!/bin/bash

# Update package list and install dependencies
sudo apt-get update
sudo apt-get install -y unzip curl

# Download the AWS CLI archive
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"

# Unzip the archive
unzip awscliv2.zip

# Run the install script
sudo ./aws/install

# Verify the installation
aws --version

# Clean up
rm -rf aws awscliv2.zip