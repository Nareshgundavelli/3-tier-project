# 3-Tier Architecture Application using Kubernetes (kubeadm) on AWS

## Introduction

This project implements a **3-Tier Architecture application** using **Kubernetes (kubeadm)** on **AWS EC2 instances**. The application is divided into three layers:

* **Frontend** – Handles user requests and UI
* **Backend** – Processes business logic
* **Database** – Stores application data

Each tier is deployed as a separate Kubernetes component. This approach provides:

* Easy management
* Independent scaling
* Better security
* Fault isolation

---

## Architecture Overview

* Kubernetes Cluster created using **kubeadm**
* One **Master Node** (Control Plane)
* Two **Worker Nodes**:

  * One for **Application Pods** (Frontend + Backend)
  * One for **Database (PostgreSQL)**

---

## Set Up Instances

Launch **3 EC2 instances**:

### Master Node

* **Name**: Master
* **Image**: Ubuntu
* **Instance Type**: t3.small
* **Open Ports**:

  * 22, 80, 443, 6443, 10250

---

### Worker Node 1 (Pods)

* **Name**: Pods
* **Image**: Ubuntu
* **Instance Type**: t3.micro
* **Open Ports**:

  * 22, 80, 443, 6443, 10250, 5432

---

### Worker Node 2 (Database)

* **Name**: Db
* **Image**: Ubuntu
* **Instance Type**: t3.micro
* **Open Ports**:

  * 22, 80, 443, 6443, 10250

---

Connect to instances using **MobaXterm** with **public IP and key pair**.

---

## Port Usage Explanation

* **22 (SSH)** – Secure remote login
* **80 (HTTP)** – Web traffic
* **443 (HTTPS)** – Secure web traffic (SSL/TLS)
* **6443** – Kubernetes API Server communication
* **10250** – Kubelet communication
* **5432** – PostgreSQL default port

---

## Kubernetes Installation (All Nodes)

### Disable Swap

Swap must be disabled because:

* Kubernetes kills containers if memory limits are exceeded
* Swap makes containers slow and unstable

Linux uses swap as virtual memory, but Kubernetes requires predictable memory behavior.

```bash
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab
```

---

## Routing & Firewall Configuration

Linux does not enable all Kubernetes-required networking features by default.

### Why This Is Needed

* Containers use **OverlayFS**
* Kubernetes networking uses **Linux bridges**
* Traffic must pass through **iptables**

Without this:

* Pods cannot communicate
* Services fail
* Network policies do not work

---

### Load Kernel Modules

```bash
sudo modprobe overlay
sudo modprobe br_netfilter
```

---

### Configure Kernel Networking Rules

Create configuration file:

```bash
sudo tee /etc/sysctl.d/k8s.conf <<EOF
net.bridge.bridge-nf-call-iptables=1
net.ipv4.ip_forward=1
EOF
```

Apply changes:

```bash
sudo sysctl --system
```

#### Result if Missing

| Setting      | Result                          |
| ------------ | ------------------------------- |
| overlay      | Containers won’t start          |
| br_netfilter | Services & NetworkPolicies fail |
| ip_forward   | Pods cannot communicate         |

---

## Install Container Runtime (containerd)

Kubernetes flow:

```
kubectl → kube-apiserver → kubelet → containerd → runc → Linux Kernel
```

### Install containerd

```bash
sudo apt update
sudo apt install -y containerd
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml
```

### Fix cgroup Driver

cgroups control:

* CPU limits
* Memory limits
* Process isolation

```bash
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
sudo systemctl restart containerd
sudo systemctl enable containerd
```

---

## Install Kubernetes Tools (All Nodes)

### What is kubeadm?

* Initializes the cluster
* Helps worker nodes join
* Installs the Kubernetes control plane

### Control Plane Components

* **kube-apiserver** – Main entry point
* **kube-scheduler** – Decides pod placement
* **kube-controller-manager** – Maintains desired state
* **etcd** – Stores cluster state

---

### Install Kubernetes Packages

```bash
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.29/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg

echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.29/deb/ /" | sudo tee /etc/apt/sources.list.d/kubernetes.list

sudo apt update
sudo apt install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl
```

---

## Initialize Kubernetes Cluster (Master Node Only)

```bash
sudo kubeadm init --pod-network-cidr=192.168.0.0/16
```

### Configure kubectl

```bash
mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $USER:$USER $HOME/.kube/config
```

---

## Install Pod Network (Calico)

```bash
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml
```

---

## Join Worker Nodes

Run the generated `kubeadm join` command on both worker nodes.

Check nodes:

```bash
kubectl get nodes
```

---

## Label Worker Nodes

```bash
kubectl label node k8s-worker1 role=app
kubectl label node k8s-worker2 role=db
kubectl get nodes --show-labels
```

---

## Application Deployment

### Get Project Code

```bash
git clone https://github.com/Nareshgundavelli/3-tier-project.git
```

### Apply Kubernetes Manifests

```bash
kubectl apply -f namespace.yaml

cd database
kubectl apply -f postgres-deployment.yaml

cd ../backend
kubectl apply -f backend-deployment.yaml

cd ../frontend
kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-configmap.yaml
```

Check resources:

```bash
kubectl get pods -n webapp
kubectl get svc -n webapp
```

---

## Access Application

* Open EC2 Security Group
* Allow ports **32000** and **3000**

```bash
kubectl exec -it postgres-pod -- psql -U admin -d <dbname>
```

Access in browser:

```
http://<EC2-PUBLIC-IP>:32000
```

---

## Access Application Using Domain

### Install Nginx

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl status nginx
```

### Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/default
```

```nginx
server {
    listen 80;
    server_name visysems.naresh.living;

    location / {
        proxy_pass http://127.0.0.1:31264;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

## Final Access

```
http://yourdomain.com
```

---

## Conclusion

This project demonstrates a complete **3-Tier Kubernetes architecture** using **kubeadm on AWS**, covering:

* Cluster setup
* Networking
* Application deployment
* Domain-based access

It provides a strong foundation for real-world Kubernetes deployments and DevOps practices.
