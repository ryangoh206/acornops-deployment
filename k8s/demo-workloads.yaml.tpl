apiVersion: v1
kind: Namespace
metadata:
  name: __DEMO_NAMESPACE__
  labels:
    app.kubernetes.io/name: acornops-demo
    app.kubernetes.io/part-of: acornops
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: acornops-demo-healthy
  namespace: __DEMO_NAMESPACE__
  labels:
    app.kubernetes.io/name: acornops-demo-healthy
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: acornops-demo-healthy
  template:
    metadata:
      labels:
        app.kubernetes.io/name: acornops-demo-healthy
    spec:
      containers:
        - name: nginx
          image: nginx:1.27.4-alpine
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 3
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: acornops-demo-healthy
  namespace: __DEMO_NAMESPACE__
spec:
  selector:
    app.kubernetes.io/name: acornops-demo-healthy
  ports:
    - name: http
      port: 80
      targetPort: 80
  type: ClusterIP
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: acornops-demo-unhealthy
  namespace: __DEMO_NAMESPACE__
  labels:
    app.kubernetes.io/name: acornops-demo-unhealthy
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: acornops-demo-unhealthy
  template:
    metadata:
      labels:
        app.kubernetes.io/name: acornops-demo-unhealthy
    spec:
      containers:
        - name: nginx
          # Intentionally misspelled so the demo starts in ImagePullBackOff and
          # can be repaired by patching the owning Deployment.
          image: nginx:1.27.4-alpnie
