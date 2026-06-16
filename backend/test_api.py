#!/usr/bin/env python3
"""Quick test script for Admin Backend API"""
import requests
import sys

API_BASE = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    print("Testing /health...")
    response = requests.get(f"{API_BASE}/health")
    assert response.status_code == 200
    print("✓ Health check passed")

def test_dashboard():
    """Test dashboard endpoint"""
    print("\nTesting /api/admin/dashboard...")
    response = requests.get(f"{API_BASE}/api/admin/dashboard")
    assert response.status_code == 200
    data = response.json()
    print(f"✓ Dashboard data received:")
    print(f"  - Total leads: {data['leads']['total']}")
    print(f"  - By type: {data['leads']['by_type']}")
    print(f"  - Avg confidence: {data['qualifications']['avg_confidence']}")
    print(f"  - CRM Sync: {data['crm_sync']}")

def test_leads():
    """Test leads endpoint"""
    print("\nTesting /api/admin/leads...")
    response = requests.get(f"{API_BASE}/api/admin/leads")
    assert response.status_code == 200
    data = response.json()
    print(f"✓ Leads data received:")
    print(f"  - Total: {data['total']}")
    print(f"  - Page: {data['page']}")
    print(f"  - Items: {len(data['items'])}")

def main():
    try:
        test_health()
        test_dashboard()
        test_leads()
        print("\n✅ All tests passed!")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()