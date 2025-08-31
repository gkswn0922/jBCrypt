let allOrders = [];

async function loadData() {
    try {
        console.log('데이터 로딩 시작...');
        const response = await fetch('/api/admin/orders');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('받은 데이터:', data);
        
        if (data.error) {
            throw new Error(data.message || data.error);
        }
        
        allOrders = data.orders || [];
        console.log('주문 데이터 개수:', allOrders.length);
        
        // 통계 업데이트
        updateStats(data.stats || { total: 0, sent: 0, pending: 0, today: 0 });
        
        // 테이블 업데이트
        updateTable(allOrders);
        
        // 마지막 업데이트 시간
        document.getElementById('lastUpdated').textContent = 
            `마지막 업데이트: ${new Date().toLocaleString('ko-KR')}`;
            
    } catch (error) {
        console.error('데이터 로딩 실패:', error);
        document.getElementById('orderTableBody').innerHTML = 
            `<tr><td colspan="10" style="text-align: center; color: #ef4444;">
                데이터 로딩에 실패했습니다.<br>
                <small>${error.message}</small>
            </td></tr>`;
        
        // 통계도 초기화
        updateStats({ total: 0, sent: 0, pending: 0, today: 0 });
    }
}

function updateStats(stats) {
    document.getElementById('totalOrders').textContent = stats.total;
    document.getElementById('sentMessages').textContent = stats.sent;
    document.getElementById('pendingMessages').textContent = stats.pending;
    document.getElementById('todayOrders').textContent = stats.today;
}

function updateTable(orders) {
    const tbody = document.getElementById('orderTableBody');
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #666;">주문 데이터가 없습니다.</td></tr>';
        return;
    }
    
    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>${order.productOrderId}</td>
            <td>${order.ordererName}</td>
            <td>${formatPhoneNumber(order.ordererTel)}</td>
            <td>${order.email}</td>
            <td>${order.productName || '-'}</td>
            <td>${order.day || '-'}일</td>
            <td>${order.quantity || '-'}</td>
            <td>${order.QR ? `<a href="${order.QR}" target="_blank" class="qr-link">QR 보기</a>` : '<span class="no-qr">없음</span>'}</td>
            <td>${getStatusBadge(order.QR)}</td>
            <td>${formatDateTime(order.created_at)}</td>
        </tr>
    `).join('');
}

function getStatusBadge(qr) {
    if (qr && qr.trim() !== '') {
        return '<span class="status-badge status-sent">전송완료</span>';
    } else {
        return '<span class="status-badge status-pending">대기중</span>';
    }
}

function formatPhoneNumber(tel) {
    const telStr = String(tel);
    if (telStr.length === 11) {
        return telStr.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    } else if (telStr.length === 10) {
        return telStr.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    }
    return telStr;
}

function formatDateTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function filterTable() {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    const filteredOrders = allOrders.filter(order => {
        return (
            order.productOrderId.toLowerCase().includes(searchTerm) ||
            order.ordererName.toLowerCase().includes(searchTerm) ||
            String(order.ordererTel).includes(searchTerm) ||
            (order.email && order.email.toLowerCase().includes(searchTerm))
        );
    });
    updateTable(filteredOrders);
}

// 페이지 로드 시 데이터 로딩
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM 로드 완료, 데이터 로딩 시작');
    loadData();
});

// 5분마다 자동 새로고침
setInterval(loadData, 5 * 60 * 1000);

// 전역 함수로 노출 (디버깅용)
window.loadData = loadData;
