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
            <td>${order.snCode ? order.snCode.replace(/\|/g, '<br>') : '-'}</td>
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
    let telStr = String(tel);
    
    // 숫자만 추출
    telStr = telStr.replace(/[^0-9]/g, '');
    
    // 맨 앞에 0이 없으면 추가 (한국 전화번호 형식)
    if (telStr.length > 0 && !telStr.startsWith('0')) {
        telStr = '0' + telStr;
    }
    
    // 길이에 따라 처리
    if (telStr.length === 11) {
        // 11자리: 010-1234-5678 형식
        return telStr.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    } else if (telStr.length === 10) {
        // 10자리: 010-123-4567 형식
        return telStr.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    } else if (telStr.length === 9) {
        // 9자리: 010-123-456 형식
        return telStr.replace(/(\d{3})(\d{3})(\d{3})/, '$1-$2-$3');
    } else if (telStr.length === 8) {
        // 8자리: 010-1234 형식
        return telStr.replace(/(\d{3})(\d{4})/, '$1-$2');
    } else {
        // 그 외: 원본 반환
        return telStr;
    }
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

// 페이지 로드 시 데이터 로딩 및 사용자 정보 확인
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM 로드 완료, 데이터 로딩 시작');
    
    // 사용자 정보 확인
    try {
        const authResponse = await fetch('/api/auth/status');
        const authData = await authResponse.json();
        
        if (authData.isAuthenticated && authData.username) {
            document.getElementById('userInfo').textContent = authData.username;
        }
    } catch (error) {
        console.error('사용자 정보 확인 실패:', error);
    }
    
    loadData();
});

// 5분마다 자동 새로고침
setInterval(loadData, 5 * 60 * 1000);

// 로그아웃 함수
async function logout() {
    if (confirm('정말 로그아웃 하시겠습니까?')) {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 로그아웃 성공 시 로그인 페이지로 이동
                window.location.href = '/login';
            } else {
                alert('로그아웃에 실패했습니다.');
            }
        } catch (error) {
            console.error('로그아웃 오류:', error);
            alert('로그아웃 중 오류가 발생했습니다.');
        }
    }
}

// 전역 함수로 노출 (디버깅용)
window.loadData = loadData;
window.logout = logout;
