package org.mindrot;

public class UserOrder {
    private Long id;
    private String ordererName;
    private String ordererTel;
    private String email;
    private Integer quantity;
    
    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public String getOrdererName() { return ordererName; }
    public void setOrdererName(String ordererName) { this.ordererName = ordererName; }
    
    public String getOrdererTel() { return ordererTel; }
    public void setOrdererTel(String ordererTel) { this.ordererTel = ordererTel; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
}
